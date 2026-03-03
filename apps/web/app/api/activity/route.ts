import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { listActivities } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(async (request: NextRequest): Promise<NextResponse> => {
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const before = request.nextUrl.searchParams.get("before") ?? undefined;

  try {
    const activities = await listActivities({ limit, before });

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        repoOwner: a.repoOwner,
        repoName: a.repoName,
        issueNumber: a.issueNumber,
        actorType: a.actorType,
        title: a.title,
        description: a.description,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch {
    const body: ApiErrorResponse = {
      error: { code: "DATABASE_UNAVAILABLE", message: "Activity data is temporarily unavailable" },
    };
    return NextResponse.json(body, { status: 503 });
  }
});
