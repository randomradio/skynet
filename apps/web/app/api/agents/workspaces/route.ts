import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { listWorkspaces, getIssueById } from "@skynet/db";

export const runtime = "nodejs";

export const GET = withAuth(
  async (
    request: NextRequest,
    _user: JWTPayload,
  ): Promise<NextResponse> => {
    const url = request.nextUrl;
    const status = url.searchParams.get("status") ?? undefined;
    const assignedTo = url.searchParams.get("assignedTo") ?? undefined;

    const workspaces = await listWorkspaces({ status, assignedTo });

    // Enrich with issue titles
    const enriched = await Promise.all(
      workspaces.map(async (ws) => {
        let issueTitle: string | null = null;
        try {
          const result = await getIssueById(ws.issueId);
          issueTitle = result.issue?.title ?? null;
        } catch {
          // best effort
        }
        return {
          id: ws.id,
          issueId: ws.issueId,
          issueTitle,
          status: ws.status,
          branch: ws.branch,
          assignedTo: ws.assignedTo,
          sessionCount: ws.sessionCount,
          expiresAt: ws.expiresAt?.toISOString() ?? null,
          createdAt: ws.createdAt.toISOString(),
          updatedAt: ws.updatedAt.toISOString(),
        };
      }),
    );

    return NextResponse.json({ workspaces: enriched });
  },
);
