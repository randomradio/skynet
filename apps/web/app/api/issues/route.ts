import { NextRequest, NextResponse } from "next/server";

import { getRequestToken } from "@/lib/auth/request-token";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { listIssuesPage } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

interface IssueListResponse {
  issues: Array<{ id: string; title: string; state: "open" | "closed" }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  source: "database" | "not_configured";
}

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = getRequestToken(request);
  if (!token) {
    const body: ApiErrorResponse = {
      error: { code: "UNAUTHORIZED", message: "Missing authentication token" },
    };
    return NextResponse.json(body, { status: 401 });
  }

  const user = await verifyAccessToken(token);
  if (!user) {
    const body: ApiErrorResponse = {
      error: { code: "UNAUTHORIZED", message: "Not authenticated" },
    };
    return NextResponse.json(body, { status: 401 });
  }

  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "20",
    10,
  );

  try {
    const result = await listIssuesPage({ page, limit });
    const response: IssueListResponse = {
      issues: result.items.map((issue) => ({
        id: issue.id,
        title: issue.title,
        state: issue.state,
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      source: result.source,
    };

    return NextResponse.json(response);
  } catch {
    const body: ApiErrorResponse = {
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Issue data is temporarily unavailable",
      },
    };

    return NextResponse.json(body, { status: 503 });
  }
}
