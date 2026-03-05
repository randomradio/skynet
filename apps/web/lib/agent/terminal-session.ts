import {
  appendTerminalOutput,
  setBashSessionId,
  setWaitingForInput,
  updateAgentRunStatus,
} from "@skynet/db";
import { getSandbox } from "@/lib/sandbox";
import { detectInputPrompt } from "./input-detector";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PREFIX = "[TerminalSession]";

export class TerminalSession {
  private sessionId: string;
  private outputOffset = 0;
  private destroyed = false;

  constructor(private runId: string) {
    this.sessionId = `agent-${runId}`;
    console.log(`${PREFIX} created session_id=${this.sessionId} run_id=${runId}`);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async start(
    command: string,
    workDir: string,
    env?: Record<string, string>,
  ): Promise<{ exitCode: number }> {
    const sandbox = getSandbox();
    console.log(`${PREFIX} [${this.sessionId}] start command=${JSON.stringify(command)} workDir=${workDir}`);

    // 1. Create session
    const createResult = await sandbox.shell.createSession({ id: this.sessionId, exec_dir: workDir });
    console.log(`${PREFIX} [${this.sessionId}] createSession ok=${createResult.ok}`);
    if (!createResult.ok) {
      throw new Error(`Failed to create sandbox session: ${JSON.stringify(createResult)}`);
    }

    // 2. Store session ID in DB
    await setBashSessionId(this.runId, this.sessionId);
    console.log(`${PREFIX} [${this.sessionId}] stored session ID in DB`);

    // 3. Set env vars if provided
    if (env && Object.keys(env).length > 0) {
      const envKeys = Object.keys(env);
      console.log(`${PREFIX} [${this.sessionId}] setting env vars: ${envKeys.join(", ")}`);
      const exportCmd = Object.entries(env)
        .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
        .join(" && ");
      const envResult = await sandbox.shell.execCommand({
        id: this.sessionId,
        command: exportCmd,
        timeout: 10,
      });
      console.log(`${PREFIX} [${this.sessionId}] env set ok=${envResult.ok}`);
    }

    // 4. Execute command async
    const execResult = await sandbox.shell.execCommand({
      id: this.sessionId,
      command,
      async_mode: true,
      timeout: 1800, // 30 min max
    });
    console.log(`${PREFIX} [${this.sessionId}] exec ok=${execResult.ok} status=${execResult.ok ? execResult.body.data?.status : "N/A"}`);

    // 5. Poll loop (runs until process exits)
    console.log(`${PREFIX} [${this.sessionId}] entering poll loop`);
    return this.pollLoop();
  }

  private async pollLoop(): Promise<{ exitCode: number }> {
    const sandbox = getSandbox();
    let consecutiveFailures = 0;
    let pollCount = 0;

    while (!this.destroyed) {
      pollCount++;
      try {
        const result = await sandbox.shell.view({ id: this.sessionId });
        if (!result.ok) {
          consecutiveFailures++;
          console.log(`${PREFIX} [${this.sessionId}] poll#${pollCount} view FAILED (consecutive=${consecutiveFailures})`);
          if (consecutiveFailures >= 10) {
            console.log(`${PREFIX} [${this.sessionId}] giving up after ${consecutiveFailures} consecutive failures`);
            return { exitCode: -1 };
          }
          await sleep(500);
          continue;
        }
        consecutiveFailures = 0;
        const data = result.body.data;
        const fullOutput = data?.output ?? "";

        if (fullOutput.length > this.outputOffset) {
          const newChunk = fullOutput.slice(this.outputOffset);
          this.outputOffset = fullOutput.length;

          if (pollCount <= 20 || pollCount % 10 === 0) {
            console.log(`${PREFIX} [${this.sessionId}] poll#${pollCount} new output +${newChunk.length}chars (total=${fullOutput.length}) status=${data?.status}`);
          }

          await appendTerminalOutput(this.runId, newChunk);

          // Check for input prompts
          if (detectInputPrompt(newChunk)) {
            console.log(`${PREFIX} [${this.sessionId}] detected input prompt`);
            await setWaitingForInput(this.runId, true);
            await updateAgentRunStatus(this.runId, "waiting_for_input");
          }
        } else if (pollCount <= 5 || pollCount % 20 === 0) {
          console.log(`${PREFIX} [${this.sessionId}] poll#${pollCount} no new output, status=${data?.status}`);
        }

        const status = data?.status;
        if (
          status === "completed" ||
          status === "terminated" ||
          status === "hard_timeout"
        ) {
          console.log(`${PREFIX} [${this.sessionId}] process ended: status=${status} exit_code=${data?.exit_code} total_output=${fullOutput.length}chars`);
          return { exitCode: data?.exit_code ?? 1 };
        }
      } catch (err) {
        if (this.destroyed) {
          console.log(`${PREFIX} [${this.sessionId}] poll error after destroy, breaking`);
          break;
        }
        const errMsg = err instanceof Error ? err.message : "unknown";
        console.error(`${PREFIX} [${this.sessionId}] poll#${pollCount} exception: ${errMsg}`);
        await appendTerminalOutput(
          this.runId,
          `\n[poll error: ${errMsg}]\n`,
        );
      }

      await sleep(500);
    }

    console.log(`${PREFIX} [${this.sessionId}] poll loop exited (destroyed=${this.destroyed})`);
    return { exitCode: -1 };
  }

  async sendInput(input: string): Promise<void> {
    console.log(`${PREFIX} [${this.sessionId}] sendInput: ${JSON.stringify(input)}`);
    const sandbox = getSandbox();
    const result = await sandbox.shell.writeToProcess({
      id: this.sessionId,
      input,
      press_enter: !input.endsWith("\n"),
    });
    console.log(`${PREFIX} [${this.sessionId}] writeToProcess ok=${result.ok} status=${result.ok ? result.body.data?.status : "N/A"}`);
    await setWaitingForInput(this.runId, false);
    await updateAgentRunStatus(this.runId, "coding");
  }

  async kill(): Promise<void> {
    console.log(`${PREFIX} [${this.sessionId}] kill()`);
    this.destroyed = true;
    const sandbox = getSandbox();
    try {
      const result = await sandbox.shell.killProcess({ id: this.sessionId });
      console.log(`${PREFIX} [${this.sessionId}] killProcess ok=${result.ok}`);
    } catch (err) {
      console.log(`${PREFIX} [${this.sessionId}] killProcess error: ${err instanceof Error ? err.message : err}`);
    }
  }

  async destroy(): Promise<void> {
    console.log(`${PREFIX} [${this.sessionId}] destroy()`);
    this.destroyed = true;
    const sandbox = getSandbox();
    try {
      await sandbox.shell.killProcess({ id: this.sessionId });
    } catch {
      // best effort
    }
    try {
      await sandbox.shell.cleanupSession(this.sessionId);
      console.log(`${PREFIX} [${this.sessionId}] cleanupSession done`);
    } catch {
      // best effort
    }
  }
}
