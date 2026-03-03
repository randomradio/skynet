import { NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { countIssuesByState, countIssuesByPriority, listActivities } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(async (): Promise<NextResponse> => {
  try {
    const [stateCounts, priorityCounts, recentActivity] = await Promise.all([
      countIssuesByState(),
      countIssuesByPriority(),
      listActivities({ limit: 10 }),
    ]);

    const p0p1Count = (priorityCounts["P0"] ?? 0) + (priorityCounts["P1"] ?? 0);

    return NextResponse.json({
      stats: {
        openIssues: stateCounts.open,
        closedIssues: stateCounts.closed,
        p0p1Issues: p0p1Count,
        priorityCounts,
      },
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        actorType: a.actorType,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch {
    const body: ApiErrorResponse = {
      error: { code: "DATABASE_UNAVAILABLE", message: "Dashboard data is temporarily unavailable" },
    };
    return NextResponse.json(body, { status: 503 });
  }
});
