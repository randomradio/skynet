import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { hasGitHubToken } from "@/lib/github/client";
import { fullSyncRepository } from "@/lib/github/sync-issue";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const POST = withAuth(
  async (
    _request,
    _user: JWTPayload,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const params = await context.params;

    if (!hasGitHubToken()) {
      const body: ApiErrorResponse = {
        error: { code: "GITHUB_NOT_CONFIGURED", message: "GitHub token is not configured" },
      };
      return NextResponse.json(body, { status: 503 });
    }

    // The id param here is "owner/name" format or we parse from query
    // For simplicity, accept owner and name from request body
    let owner: string;
    let name: string;

    try {
      const body = await _request.json();
      owner = body.owner;
      name = body.name;
    } catch {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "owner and name are required in body" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    if (!owner || !name) {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "owner and name are required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      const synced = await fullSyncRepository(owner, name);
      return NextResponse.json({
        repositoryId: params.id,
        synced,
        message: `Synced ${synced} issues from ${owner}/${name}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      const body: ApiErrorResponse = {
        error: { code: "SYNC_FAILED", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
