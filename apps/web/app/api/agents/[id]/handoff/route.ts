import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getAgentRunById, getWorkspaceById, reassignWorkspace } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const POST = withAuth(
  async (
    request: NextRequest,
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
      const { assignTo } = await request.json();
      if (!assignTo || typeof assignTo !== "string") {
        const body: ApiErrorResponse = {
          error: { code: "INVALID_REQUEST", message: "assignTo (user id) is required" },
        };
        return NextResponse.json(body, { status: 400 });
      }

      const run = await getAgentRunById(params.id);
      if (!run) {
        const body: ApiErrorResponse = {
          error: { code: "NOT_FOUND", message: "Agent run not found" },
        };
        return NextResponse.json(body, { status: 404 });
      }

      if (!run.workspaceId) {
        const body: ApiErrorResponse = {
          error: { code: "NO_WORKSPACE", message: "Agent run has no associated workspace" },
        };
        return NextResponse.json(body, { status: 400 });
      }

      const workspace = await getWorkspaceById(run.workspaceId);
      if (!workspace || workspace.status === "completed" || workspace.status === "expired") {
        const body: ApiErrorResponse = {
          error: { code: "INVALID_STATE", message: "Workspace is not available for handoff" },
        };
        return NextResponse.json(body, { status: 409 });
      }

      await reassignWorkspace(run.workspaceId, assignTo);

      return NextResponse.json({
        ok: true,
        workspaceId: run.workspaceId,
        assignedTo: assignTo,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to hand off agent run";
      const body: ApiErrorResponse = {
        error: { code: "HANDOFF_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
