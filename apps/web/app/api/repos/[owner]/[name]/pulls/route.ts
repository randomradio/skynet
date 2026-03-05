import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { listPullRequestsPage } from "@skynet/db";

export const runtime = "nodejs";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export const GET = withAuth(async (
  request: NextRequest,
  _user,
  context: { params: Promise<Record<string, string>> },
): Promise<NextResponse> => {
  const { owner, name } = await context.params;
  const sp = request.nextUrl.searchParams;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  const limit = Number.parseInt(sp.get("limit") ?? "20", 10);
  const state = sp.get("state") as "open" | "closed" | "merged" | undefined;

  const result = await safe(
    () => listPullRequestsPage({
      page,
      limit,
      repoOwner: owner,
      repoName: name,
      state: state || undefined,
    }),
    { items: [], page, limit, total: 0 },
  );

  return NextResponse.json({
    pullRequests: result.items.map((pr) => ({
      id: pr.id,
      number: pr.number,
      repoOwner: pr.repoOwner,
      repoName: pr.repoName,
      title: pr.title,
      state: pr.state,
      headBranch: pr.headBranch,
      baseBranch: pr.baseBranch,
      linkedIssueNumbers: pr.linkedIssueNumbers,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      createdAt: pr.createdAt?.toISOString() ?? null,
      updatedAt: pr.updatedAt?.toISOString() ?? null,
      mergedAt: pr.mergedAt?.toISOString() ?? null,
    })),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
    },
  });
});
