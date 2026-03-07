import { NextRequest, NextResponse } from "next/server";

import { withRepoAccess } from "@/lib/auth/with-repo-access";
import { hasGitHubToken } from "@/lib/github/client";
import { fullSyncPullRequests } from "@/lib/github/sync-pr";
import { getRepositoryByOwnerName, listPullRequestsPage } from "@skynet/db";

export const runtime = "nodejs";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function shouldAutoSyncRepository(owner: string, name: string): Promise<boolean> {
  const repo = await safe(() => getRepositoryByOwnerName(owner, name), null);
  if (!repo) return false;

  const minIntervalMs = parsePositiveInt(
    process.env.REPO_AUTO_SYNC_MIN_INTERVAL_MS,
    5 * 60 * 1000,
  );
  if (!repo.lastSyncedAt) return true;
  return Date.now() - repo.lastSyncedAt.getTime() >= minIntervalMs;
}

export const GET = withRepoAccess(async (
  request: NextRequest,
  _user,
  context: { params: Promise<Record<string, string>> },
): Promise<NextResponse> => {
  const { owner, name } = await context.params;
  const sp = request.nextUrl.searchParams;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  const limit = Number.parseInt(sp.get("limit") ?? "20", 10);
  const state = sp.get("state") as "open" | "closed" | "merged" | undefined;

  let result = await safe(
    () => listPullRequestsPage({
      page,
      limit,
      repoOwner: owner,
      repoName: name,
      state: state || undefined,
    }),
    { items: [], page, limit, total: 0 },
  );

  const canAutoSync =
    result.total === 0 &&
    page <= 1 &&
    !state &&
    hasGitHubToken() &&
    (await shouldAutoSyncRepository(owner, name));

  if (canAutoSync) {
    await safe(() => fullSyncPullRequests(owner, name), 0);
    result = await safe(
      () =>
        listPullRequestsPage({
          page,
          limit,
          repoOwner: owner,
          repoName: name,
          state: state || undefined,
        }),
      { items: [], page, limit, total: 0 },
    );
  }

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
