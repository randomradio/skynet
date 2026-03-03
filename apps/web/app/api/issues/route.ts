import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { listIssuesPage } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(async (request: NextRequest): Promise<NextResponse> => {
  const sp = request.nextUrl.searchParams;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  const limit = Number.parseInt(sp.get("limit") ?? "20", 10);

  const state = sp.get("state") as "open" | "closed" | undefined;
  const aiType = sp.get("ai_type") as "bug" | "feature" | "task" | "question" | undefined;
  const aiPriority = sp.get("ai_priority") as "P0" | "P1" | "P2" | "P3" | undefined;
  const repoOwner = sp.get("repo_owner") ?? undefined;
  const repoName = sp.get("repo_name") ?? undefined;

  try {
    const result = await listIssuesPage({
      page,
      limit,
      state: state || undefined,
      aiType: aiType || undefined,
      aiPriority: aiPriority || undefined,
      repoOwner: repoOwner || undefined,
      repoName: repoName || undefined,
    });

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
  } catch {
    const body: ApiErrorResponse = {
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Issue data is temporarily unavailable",
      },
    };
    return NextResponse.json(body, { status: 503 });
  }
});
