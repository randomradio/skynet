import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getIssueById } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

interface IssueDetailResponse {
  issue: {
    id: string;
    githubId: number;
    number: number;
    repoOwner: string;
    repoName: string;
    title: string;
    body: string | null;
    state: "open" | "closed";
    labels: unknown;
    aiType: "bug" | "feature" | "task" | "question" | null;
    aiPriority: "P0" | "P1" | "P2" | "P3" | null;
    aiSummary: string | null;
    aiTags: unknown;
    aiAnalysis: unknown;
    duplicateOf: number | null;
    relatedIssues: unknown;
    lastAnalyzedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    syncedAt: string;
  } | null;
  source: "database" | "not_configured";
}

export const runtime = "nodejs";

function toIsoString(dateValue: Date | null): string | null {
  return dateValue ? dateValue.toISOString() : null;
}

export const GET = withAuth(
  async (
    _request,
    _user: JWTPayload,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const params = await context.params;
    if (!params.id) {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "Issue id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      const result = await getIssueById(params.id);
      if (result.source === "not_configured") {
        const response: IssueDetailResponse = {
          issue: null,
          source: "not_configured",
        };
        return NextResponse.json(response);
      }

      if (!result.issue) {
        const body: ApiErrorResponse = {
          error: { code: "NOT_FOUND", message: "Issue not found" },
        };
        return NextResponse.json(body, { status: 404 });
      }

      const response: IssueDetailResponse = {
        issue: {
          ...result.issue,
          lastAnalyzedAt: toIsoString(result.issue.lastAnalyzedAt),
          createdAt: toIsoString(result.issue.createdAt),
          updatedAt: toIsoString(result.issue.updatedAt),
          syncedAt: result.issue.syncedAt.toISOString(),
        },
        source: "database",
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
  },
);
