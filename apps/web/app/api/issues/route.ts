import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { listIssuesPage } from "@skynet/db";

export const runtime = "nodejs";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export const GET = withAuth(async (request: NextRequest): Promise<NextResponse> => {
  const sp = request.nextUrl.searchParams;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  const limit = Number.parseInt(sp.get("limit") ?? "20", 10);

  const state = sp.get("state") as "open" | "closed" | undefined;
  const aiType = sp.get("ai_type") as "bug" | "feature" | "task" | "question" | undefined;
  const aiPriority = sp.get("ai_priority") as "P0" | "P1" | "P2" | "P3" | undefined;
  const repoOwner = sp.get("repo_owner") ?? undefined;
  const repoName = sp.get("repo_name") ?? undefined;

  const result = await safe(
    () => listIssuesPage({
      page,
      limit,
      state: state || undefined,
      aiType: aiType || undefined,
      aiPriority: aiPriority || undefined,
      repoOwner: repoOwner || undefined,
      repoName: repoName || undefined,
    }),
    { items: [], page, limit, total: 0, source: "not_configured" as const },
  );

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
});
