import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getAgentRunById, pauseWorkspace } from "@skynet/db";
import { pauseRunningAgent } from "@/lib/agent/engine";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const POST = withAuth(
  async (
    _request,
    _user: JWTPayload,
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

      if (run.status === "completed" || run.status === "failed" || run.status === "cancelled" || run.status === "paused") {
        const body: ApiErrorResponse = {
          error: { code: "INVALID_STATE", message: `Cannot pause agent run in ${run.status} state` },
        };
        return NextResponse.json(body, { status: 409 });
      }

      // Pause the running agent (kills terminal, updates DB)
      await pauseRunningAgent(params.id);

      // Also pause the associated workspace if one exists
      let workspaceStatus: string | undefined;
      let expiresAt: string | undefined;
      if (run.workspaceId) {
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pauseWorkspace(run.workspaceId, 24);
        workspaceStatus = "paused";
        expiresAt = expiry.toISOString();
      }

      return NextResponse.json({
        ok: true,
        id: params.id,
        status: "paused",
        workspaceStatus,
        expiresAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause agent run";
      const body: ApiErrorResponse = {
        error: { code: "PAUSE_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
