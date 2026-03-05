import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { getGitHubClient, hasGitHubToken } from "@/lib/github/client";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

// Simple in-memory cache with 5-min TTL
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 5 * 60 * 1000;

export const GET = withAuth(async (
  _request: NextRequest,
  _user,
  context: { params: Promise<Record<string, string>> },
): Promise<NextResponse> => {
  const { owner, name, number: numStr } = await context.params;
  const prNumber = Number.parseInt(numStr, 10);

  if (Number.isNaN(prNumber)) {
    const body: ApiErrorResponse = {
      error: { code: "BAD_REQUEST", message: "Invalid pull request number" },
    };
    return NextResponse.json(body, { status: 400 });
  }

  if (!hasGitHubToken()) {
    const body: ApiErrorResponse = {
      error: { code: "NOT_CONFIGURED", message: "GitHub token not configured" },
    };
    return NextResponse.json(body, { status: 503 });
  }

  const cacheKey = `${owner}/${name}/pulls/${prNumber}/files`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const gh = getGitHubClient();
    const files = await gh.listPullRequestFiles(owner, name, prNumber);

    const response = {
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch ?? null,
      })),
    };

    cache.set(cacheKey, { data: response, ts: Date.now() });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch PR files";
    const body: ApiErrorResponse = {
      error: { code: "GITHUB_ERROR", message },
    };
    return NextResponse.json(body, { status: 502 });
  }
});
