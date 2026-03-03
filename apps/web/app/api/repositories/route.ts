import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { listRepositories, upsertRepository } from "@skynet/db";
import { getGitHubClient, hasGitHubToken } from "@/lib/github/client";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(async (): Promise<NextResponse> => {
  try {
    const repos = await listRepositories();
    return NextResponse.json({
      repositories: repos.map((r) => ({
        id: r.id,
        githubId: r.githubId,
        owner: r.owner,
        name: r.name,
        description: r.description,
        isPrivate: r.isPrivate,
        defaultBranch: r.defaultBranch,
        syncEnabled: r.syncEnabled,
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    const body: ApiErrorResponse = {
      error: { code: "DATABASE_UNAVAILABLE", message: "Repository data is temporarily unavailable" },
    };
    return NextResponse.json(body, { status: 503 });
  }
});

export const POST = withAuth(
  async (
    request: NextRequest,
  ): Promise<NextResponse> => {
    if (!hasGitHubToken()) {
      const body: ApiErrorResponse = {
        error: { code: "GITHUB_NOT_CONFIGURED", message: "GitHub token is not configured" },
      };
      return NextResponse.json(body, { status: 503 });
    }

    const { owner, name } = await request.json();
    if (!owner || !name) {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "owner and name are required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      const client = getGitHubClient();
      const repo = await client.getRepository(owner, name);

      const id = await upsertRepository({
        githubId: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        description: repo.description,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
      });

      return NextResponse.json({ id, owner: repo.owner.login, name: repo.name }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to onboard repository";
      const body: ApiErrorResponse = {
        error: { code: "ONBOARD_FAILED", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
