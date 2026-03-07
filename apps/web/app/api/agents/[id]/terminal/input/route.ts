import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { ensureAgentRunAccess } from "@/lib/auth/agent-run-access";
import { cancelAgentRun, getAgentRunById, setWaitingForInput, updateAgentRunStatus } from "@skynet/db";
import { getTerminalSession, requestCancellation } from "@/lib/agent/engine";
import { getSandbox } from "@/lib/sandbox";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

const PREFIX = "[terminal/input]";

/**
 * POST endpoint to send user input to an interactive agent's terminal.
 * Body: { input: string, type?: "text" | "interrupt" }
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    user: JWTPayload,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const params = await context.params;
    if (!params.id) {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "Agent run id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const runId = params.id;

    const run = await getAgentRunById(runId);
    if (!run) {
      const body: ApiErrorResponse = {
        error: { code: "NOT_FOUND", message: "Agent run not found" },
      };
      return NextResponse.json(body, { status: 404 });
    }

    const access = await ensureAgentRunAccess(request, user, {
      issueId: run.issueId,
      pullRequestId: run.pullRequestId,
    });
    if (!access.allowed) {
      return access.response;
    }

    if (run.mode !== "interactive") {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "Input is only available for interactive mode" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const body = await request.json();
    const { input, type = "text" } = body as { input?: string; type?: string };

    console.log(`${PREFIX} [${runId.slice(0, 8)}] type=${type} input=${JSON.stringify(input ?? "").slice(0, 100)}`);

    if (type === "interrupt") {
      console.log(`${PREFIX} [${runId.slice(0, 8)}] sending interrupt`);
      await cancelAgentRun(runId);
      requestCancellation(runId);
      if (run.bashSessionId) {
        try {
          const sandbox = getSandbox();
          await sandbox.shell.killProcess({ id: run.bashSessionId });
        } catch {
          // best effort
        }
      }
      return NextResponse.json({ ok: true, action: "interrupted" });
    }

    if (!input && input !== "") {
      const errBody: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "input is required" },
      };
      return NextResponse.json(errBody, { status: 400 });
    }

    const session = getTerminalSession(runId);
    if (session) {
      try {
        await session.sendInput(input!);
        console.log(`${PREFIX} [${runId.slice(0, 8)}] input sent via in-memory session`);
        return NextResponse.json({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send input";
        console.error(`${PREFIX} [${runId.slice(0, 8)}] sendInput error: ${message}`);
        const errBody: ApiErrorResponse = {
          error: { code: "TERMINAL_ERROR", message },
        };
        return NextResponse.json(errBody, { status: 500 });
      }
    }

    if (!run.bashSessionId) {
      console.log(`${PREFIX} [${runId.slice(0, 8)}] no terminal session available`);
      const errBody: ApiErrorResponse = {
        error: { code: "NOT_FOUND", message: "No active terminal session for this agent run" },
      };
      return NextResponse.json(errBody, { status: 404 });
    }

    try {
      const sandbox = getSandbox();
      const writeResult = await sandbox.shell.writeToProcess({
        id: run.bashSessionId,
        input: input!,
        press_enter: !input!.endsWith("\n"),
      });
      if (!writeResult.ok) {
        const errBody: ApiErrorResponse = {
          error: { code: "TERMINAL_ERROR", message: "Failed to write input to sandbox session" },
        };
        return NextResponse.json(errBody, { status: 500 });
      }

      await setWaitingForInput(runId, false);
      await updateAgentRunStatus(runId, "coding");
      console.log(`${PREFIX} [${runId.slice(0, 8)}] input sent via sandbox fallback session`);
      return NextResponse.json({ ok: true, via: "sandbox" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send input";
      console.error(`${PREFIX} [${runId.slice(0, 8)}] fallback sendInput error: ${message}`);
      const errBody: ApiErrorResponse = {
        error: { code: "TERMINAL_ERROR", message },
      };
      return NextResponse.json(errBody, { status: 500 });
    }
  },
);
