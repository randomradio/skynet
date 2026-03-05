import crypto from "node:crypto";
import {
  getIssueById,
  updateAgentRunStatus,
  appendAgentRunLog,
  appendTerminalOutput,
  completeAgentRun,
  getWorkspaceByIssueId,
  getWorkspaceById,
  createWorkspace,
  activateWorkspace,
  pauseWorkspace,
  type AgentLog,
  type AgentArtifact,
  type WorkspaceRow,
} from "@skynet/db";
import {
  getSandbox,
  isSandboxAvailable,
  ensureRepoCloned,
  fetchLatest,
  createWorktree,
  cleanupWorktree,
  getWorkingDiff,
  commitAndPush,
} from "@/lib/sandbox";
import { TerminalSession } from "./terminal-session";
import type { AgentProgressCallback } from "./engine";

const PREFIX = "[InteractiveEngine]";

async function log(
  runId: string,
  level: AgentLog["level"],
  message: string,
  metadata?: Record<string, unknown>,
  onProgress?: AgentProgressCallback,
): Promise<void> {
  const entry: AgentLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };
  console.log(`${PREFIX} [${runId.slice(0, 8)}] ${level}: ${message}`);
  await appendAgentRunLog(runId, entry);
  onProgress?.(entry);
}

export async function executeInteractiveAgent(
  runId: string,
  issueId: string,
  options?: { autoCreatePR?: boolean; tool?: string },
  onProgress?: AgentProgressCallback,
  onSessionReady?: (session: TerminalSession) => void,
): Promise<{ session: TerminalSession }> {
  const session = new TerminalSession(runId);
  let workspace: WorkspaceRow | null = null;

  console.log(`${PREFIX} [${runId.slice(0, 8)}] executeInteractiveAgent issueId=${issueId} tool=${options?.tool ?? "opencode"}`);

  try {
    // 1. Load issue
    const issueResult = await getIssueById(issueId);
    const issue = issueResult.issue;
    if (!issue) throw new Error("Issue not found");

    await log(runId, "info", `Starting interactive agent for: ${issue.title}`, {
      issueId,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
    }, onProgress);

    // 2. Check sandbox
    const sandboxAvailable = await isSandboxAvailable();
    console.log(`${PREFIX} [${runId.slice(0, 8)}] sandboxAvailable=${sandboxAvailable}`);
    if (!sandboxAvailable) {
      throw new Error("Sandbox is not available — interactive mode requires a running sandbox");
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required for interactive mode");
    }

    const sandbox = getSandbox();

    // 3. Check for existing workspace
    workspace = await getWorkspaceByIssueId(issueId);

    let worktreePath = "";
    let repoPath = "";
    let resumed = false;

    if (workspace && workspace.status === "paused") {
      // Attempt to resume existing workspace — verify worktree still exists
      try {
        const checkResult = await sandbox.shell.execCommand({
          command: `test -d "${workspace.worktreePath}/.git" && echo yes`,
          timeout: 10,
        });
        const alive = checkResult.ok && checkResult.body.data?.output?.trim() === "yes";

        if (alive) {
          worktreePath = workspace.worktreePath;
          repoPath = workspace.repoPath;
          await fetchLatest(sandbox, repoPath);
          await activateWorkspace(workspace.id, runId, workspace.assignedTo ?? workspace.createdBy);

          await appendTerminalOutput(runId, `\n--- Session ${workspace.sessionCount + 1} started (resumed) ---\n`);
          await log(runId, "info", `Resumed workspace (session #${workspace.sessionCount + 1})`, {
            workspaceId: workspace.id,
          }, onProgress);
          resumed = true;
        } else {
          // Worktree gone (sandbox restarted) — fall through to create new
          console.log(`${PREFIX} [${runId.slice(0, 8)}] workspace worktree gone, recreating...`);
          workspace = null;
        }
      } catch {
        console.log(`${PREFIX} [${runId.slice(0, 8)}] workspace check failed, recreating...`);
        workspace = null;
      }
    }

    if (!workspace) {
      // Create new workspace
      console.log(`${PREFIX} [${runId.slice(0, 8)}] cloning repo ${issue.repoOwner}/${issue.repoName}...`);
      repoPath = await ensureRepoCloned(sandbox, issue.repoOwner, issue.repoName, token);
      await fetchLatest(sandbox, repoPath);
      await log(runId, "info", "Repository ready in sandbox", { repoPath }, onProgress);

      console.log(`${PREFIX} [${runId.slice(0, 8)}] creating worktree...`);
      worktreePath = await createWorktree(sandbox, {
        repoPath,
        runId,
        mode: "develop",
        baseBranch: "main",
      });
      await log(runId, "info", `Worktree created: ${worktreePath}`, undefined, onProgress);

      const branchName = `agent/${runId.slice(0, 8)}`;
      const wsId = crypto.randomUUID();
      await createWorkspace({
        id: wsId,
        issueId,
        repoPath,
        worktreePath,
        branch: branchName,
        createdBy: "system",
      });
      await activateWorkspace(wsId, runId, "system");
      workspace = await getWorkspaceById(wsId);
    }

    // 4. Build command
    const tool = options?.tool ?? "opencode";
    const taskDescription = buildTaskDescription(issue);
    const command = `${tool} run ${JSON.stringify(taskDescription)}`;

    await updateAgentRunStatus(runId, "coding");
    await log(runId, "info", `Running: ${tool}${resumed ? " (resumed session)" : ""}`, { command }, onProgress);

    // 5. Build env vars
    const env: Record<string, string> = {};
    env.PATH = `/usr/local/bin:/usr/bin:/bin:/root/.opencode/bin:/home/gem/.opencode/bin:${process.env.PATH || ""}`;
    if (process.env.ANTHROPIC_API_KEY) {
      env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.AI_API_KEY) {
      env.AI_API_KEY = process.env.AI_API_KEY;
    }
    if (token) {
      env.GITHUB_TOKEN = token;
    }
    console.log(`${PREFIX} [${runId.slice(0, 8)}] env keys: ${Object.keys(env).join(", ")}`);

    // 6. Expose session so callers can send input while running
    onSessionReady?.(session);
    console.log(`${PREFIX} [${runId.slice(0, 8)}] session ready callback fired, starting terminal...`);

    // 7. Start terminal session (blocks until process exits)
    const startTime = Date.now();
    const { exitCode } = await session.start(command, worktreePath, env);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    await log(
      runId,
      exitCode === 0 ? "info" : "warn",
      `Process exited with code ${exitCode} after ${duration}s`,
      { exitCode, durationSec: Number(duration) },
      onProgress,
    );

    // 8. Collect results
    const artifacts: AgentArtifact[] = [];
    try {
      const diff = await getWorkingDiff(sandbox, worktreePath);
      if (diff.trim()) {
        artifacts.push({ type: "diff", content: diff });
        console.log(`${PREFIX} [${runId.slice(0, 8)}] collected diff: ${diff.length} chars`);
      }
    } catch (err) {
      console.log(`${PREFIX} [${runId.slice(0, 8)}] no diff: ${err instanceof Error ? err.message : err}`);
    }

    // 9. Auto-create PR if configured
    let branch: string | undefined;
    let prNumber: number | undefined;

    if (options?.autoCreatePR && artifacts.some((a) => a.content?.trim())) {
      try {
        const commitMsg = `feat: implement changes for issue (interactive agent)`;
        await commitAndPush(sandbox, worktreePath, commitMsg, token);
        const branchResult = await sandbox.shell.execCommand({
          command: `cd "${worktreePath}" && git rev-parse --abbrev-ref HEAD`,
          timeout: 10,
        });
        if (branchResult.ok) {
          branch = branchResult.body.data?.output?.trim();
        }
        await log(runId, "info", `Changes pushed to branch: ${branch}`, undefined, onProgress);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Push failed";
        await log(runId, "warn", `Auto-PR failed: ${msg}`, undefined, onProgress);
      }
    }

    // 10. Pause workspace (preserve worktree for resume) instead of cleaning up
    if (workspace) {
      await pauseWorkspace(workspace.id, 24);
      await log(runId, "info", "Workspace paused — worktree preserved for resume", undefined, onProgress);
    }

    const finalStatus = exitCode === 0 ? "completed" : "failed";
    await completeAgentRun(runId, {
      status: finalStatus,
      branch,
      prNumber,
      artifacts,
    });

    await log(runId, "info", `Interactive agent finished — ${finalStatus}`, {
      exitCode,
      artifactCount: artifacts.length,
      branch,
    }, onProgress);

    return { session };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`${PREFIX} [${runId.slice(0, 8)}] FATAL: ${message}`);
    await log(runId, "error", `Interactive agent failed: ${message}`, undefined, onProgress);

    // On error: still pause workspace if it exists (preserve worktree)
    if (workspace) {
      await pauseWorkspace(workspace.id, 24).catch(() => {});
    }

    try {
      await completeAgentRun(runId, { status: "failed" });
    } catch {
      // best-effort
    }

    return { session };
  }
  // NOTE: No finally block that deletes the worktree — workspace persists
}

function buildTaskDescription(issue: {
  title: string;
  body: string | null;
  aiSummary?: string | null;
}): string {
  const parts = [`Implement: ${issue.title}`];
  if (issue.body) {
    parts.push("", issue.body);
  }
  if (issue.aiSummary) {
    parts.push("", `AI Summary: ${issue.aiSummary}`);
  }
  return parts.join("\n");
}
