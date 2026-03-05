import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getWorkspaceById, completeWorkspace } from "@skynet/db";
import { cleanupWorktree, getSandbox, isSandboxAvailable } from "@/lib/sandbox";
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
        error: { code: "INVALID_REQUEST", message: "Workspace id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      const workspace = await getWorkspaceById(params.id);
      if (!workspace) {
        const body: ApiErrorResponse = {
          error: { code: "NOT_FOUND", message: "Workspace not found" },
        };
        return NextResponse.json(body, { status: 404 });
      }

      if (workspace.status === "completed" || workspace.status === "expired") {
        const body: ApiErrorResponse = {
          error: { code: "INVALID_STATE", message: `Workspace already ${workspace.status}` },
        };
        return NextResponse.json(body, { status: 409 });
      }

      // Clean up worktree if sandbox is available
      const sandboxAvailable = await isSandboxAvailable();
      if (sandboxAvailable) {
        try {
          const sandbox = getSandbox();
          await cleanupWorktree(sandbox, workspace.repoPath, workspace.worktreePath);
        } catch {
          // best effort — worktree may already be gone
        }
      }

      await completeWorkspace(params.id);

      return NextResponse.json({
        ok: true,
        id: params.id,
        status: "completed",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to close workspace";
      const body: ApiErrorResponse = {
        error: { code: "CLOSE_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
