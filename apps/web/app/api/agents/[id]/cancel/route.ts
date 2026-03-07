import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { ensureAgentRunAccess } from "@/lib/auth/agent-run-access";
import { cancelAgentRun, getAgentRunById } from "@skynet/db";
import { requestCancellation } from "@/lib/agent/engine";
import { getSandbox } from "@/lib/sandbox";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const POST = withAuth(
  async (
    request,
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

    try {
      const run = await getAgentRunById(params.id);
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

      // Request in-memory cancellation for running agents
      requestCancellation(params.id);
      if (run.bashSessionId) {
        try {
          const sandbox = getSandbox();
          await sandbox.shell.killProcess({ id: run.bashSessionId });
        } catch {
          // best effort
        }
      }

      // Also cancel in DB
      const cancelled = await cancelAgentRun(params.id);
      if (!cancelled) {
        const body: ApiErrorResponse = {
          error: {
            code: "CANCEL_FAILED",
            message: "Agent run not found or already in a terminal state",
          },
        };
        return NextResponse.json(body, { status: 409 });
      }

      return NextResponse.json({ id: params.id, status: "cancelled" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel agent run";
      const body: ApiErrorResponse = {
        error: { code: "CANCEL_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
