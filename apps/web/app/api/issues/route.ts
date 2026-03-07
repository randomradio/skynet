import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import {
  ensureRepositoryAccess,
  filterRepositoriesByAccess,
} from "@/lib/auth/repository-access";
import { hasGitHubToken } from "@/lib/github/client";
import { fullSyncRepository } from "@/lib/github/sync-issue";
import { getRepositoryByOwnerName, listIssuesPage } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function listAllIssuesForFilter(input: {
  state?: "open" | "closed";
  aiType?: "bug" | "feature" | "task" | "question";
  aiPriority?: "P0" | "P1" | "P2" | "P3";
}) {
  const items: Awaited<ReturnType<typeof listIssuesPage>>["items"] = [];
  const batchSize = 100;
  let page = 1;
  let source: "database" | "not_configured" = "database";

  // Pull all rows in batches for access filtering. Early-phase datasets are small.
  for (;;) {
    const result = await safe(
      () =>
        listIssuesPage({
          page,
          limit: batchSize,
          state: input.state,
          aiType: input.aiType,
          aiPriority: input.aiPriority,
        }),
      { items: [], page, limit: batchSize, total: 0, source: "not_configured" as const },
    );

    source = result.source;
    items.push(...result.items);

    if (result.items.length < batchSize || result.source === "not_configured") {
      break;
    }

    page += 1;
  }

  return { items, source };
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

export const GET = withAuth(async (request: NextRequest, user): Promise<NextResponse> => {
  const sp = request.nextUrl.searchParams;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  const limit = Number.parseInt(sp.get("limit") ?? "20", 10);

  const state = sp.get("state") as "open" | "closed" | undefined;
  const aiType = sp.get("ai_type") as "bug" | "feature" | "task" | "question" | undefined;
  const aiPriority = sp.get("ai_priority") as "P0" | "P1" | "P2" | "P3" | undefined;
  const repoOwner = sp.get("repo_owner") ?? undefined;
  const repoName = sp.get("repo_name") ?? undefined;

  if ((repoOwner && !repoName) || (!repoOwner && repoName)) {
    const body: ApiErrorResponse = {
      error: {
        code: "INVALID_REQUEST",
        message: "repo_owner and repo_name must be provided together",
      },
    };
    return NextResponse.json(body, { status: 400 });
  }

  if (repoOwner && repoName) {
    const access = await ensureRepositoryAccess(request, user, repoOwner, repoName);
    if (!access.allowed) {
      return access.response;
    }
  }

  if (repoOwner && repoName) {
    let result = await safe(
      () =>
        listIssuesPage({
          page,
          limit,
          state: state || undefined,
          aiType: aiType || undefined,
          aiPriority: aiPriority || undefined,
          repoOwner,
          repoName,
        }),
      { items: [], page, limit, total: 0, source: "not_configured" as const },
    );

    const canAutoSync =
      result.total === 0 &&
      page <= 1 &&
      !state &&
      !aiType &&
      !aiPriority &&
      hasGitHubToken() &&
      (await shouldAutoSyncRepository(repoOwner, repoName));

    if (canAutoSync) {
      await safe(() => fullSyncRepository(repoOwner, repoName), 0);
      result = await safe(
        () =>
          listIssuesPage({
            page,
            limit,
            state: state || undefined,
            aiType: aiType || undefined,
            aiPriority: aiPriority || undefined,
            repoOwner,
            repoName,
          }),
        { items: [], page, limit, total: 0, source: "not_configured" as const },
      );
    }

    return NextResponse.json({
      issues: result.items.map((issue) => ({
        id: issue.id,
        number: issue.number,
        repoOwner: issue.repoOwner,
        repoName: issue.repoName,
        title: issue.title,
        state: issue.state,
        labels: issue.labels,
        aiType: issue.aiType,
        aiPriority: issue.aiPriority,
        aiSummary: issue.aiSummary,
        createdAt: issue.createdAt?.toISOString() ?? null,
        updatedAt: issue.updatedAt?.toISOString() ?? null,
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      source: result.source,
    });
  }

  const all = await listAllIssuesForFilter({
    state: state || undefined,
    aiType: aiType || undefined,
    aiPriority: aiPriority || undefined,
  });

  const visibleRepoRefs = await filterRepositoriesByAccess(
    request,
    user,
    Array.from(
      new Map(
        all.items.map((issue) => [
          `${issue.repoOwner}/${issue.repoName}`.toLowerCase(),
          { owner: issue.repoOwner, name: issue.repoName },
        ]),
      ).values(),
    ),
  );
  const visibleRepoSet = new Set(
    visibleRepoRefs.map((repo) => `${repo.owner}/${repo.name}`.toLowerCase()),
  );
  const visibleIssues = all.items.filter((issue) =>
    visibleRepoSet.has(`${issue.repoOwner}/${issue.repoName}`.toLowerCase()),
  );
  const normalizedPage = Number.isNaN(page) || page < 1 ? 1 : page;
  const normalizedLimit =
    Number.isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100);
  const offset = (normalizedPage - 1) * normalizedLimit;
  const pagedIssues = visibleIssues.slice(offset, offset + normalizedLimit);

  return NextResponse.json({
    issues: pagedIssues.map((issue) => ({
      id: issue.id,
      number: issue.number,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
      title: issue.title,
      state: issue.state,
      labels: issue.labels,
      aiType: issue.aiType,
      aiPriority: issue.aiPriority,
      aiSummary: issue.aiSummary,
      createdAt: issue.createdAt?.toISOString() ?? null,
      updatedAt: issue.updatedAt?.toISOString() ?? null,
    })),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total: visibleIssues.length,
    },
    source: all.source,
  });
});
