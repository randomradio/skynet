import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import {
  countIssuesByState,
  countIssuesByPriority,
  listActivities,
  listRepositories,
  listAgentRuns,
} from "@skynet/db";

export const runtime = "nodejs";

// Wraps a promise so a single failure doesn't break Promise.all
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const GET = withAuth(async (): Promise<NextResponse> => {
  const [stateCounts, priorityCounts, recentActivity, repositories, agentRunsResult] =
    await Promise.all([
      safe(() => countIssuesByState(), { open: 0, closed: 0 }),
      safe(() => countIssuesByPriority(), {} as Record<string, number>),
      safe(() => listActivities({ limit: 10 }), []),
      safe(() => listRepositories(), []),
      safe(() => listAgentRuns({ page: 1, limit: 5 }), { items: [], page: 1, limit: 5, total: 0 }),
    ]);

  const p0p1Count = (priorityCounts["P0"] ?? 0) + (priorityCounts["P1"] ?? 0);

  return NextResponse.json({
    stats: {
      openIssues: stateCounts.open,
      closedIssues: stateCounts.closed,
      p0p1Issues: p0p1Count,
      priorityCounts,
    },
    repositories: repositories.map((r) => ({
      id: r.id,
      owner: r.owner,
      name: r.name,
      description: r.description,
      isPrivate: r.isPrivate,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    })),
    recentAgentRuns: agentRunsResult.items.map((run) => ({
      id: run.id,
      issueId: run.issueId,
      status: run.status,
      plan: run.plan,
      branch: run.branch,
      prNumber: run.prNumber,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      actorType: a.actorType,
      repoOwner: a.repoOwner,
      repoName: a.repoName,
      issueNumber: a.issueNumber,
      agentRunId: a.agentRunId,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});
