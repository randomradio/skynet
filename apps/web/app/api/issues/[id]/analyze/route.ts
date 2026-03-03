import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { analyzeIssue } from "@/lib/ai/analyze-issue";
import { hasAIConfig } from "@/lib/ai/client";
import { getIssueById, updateIssueAIFields } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const POST = withAuth(
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

    if (!hasAIConfig()) {
      const body: ApiErrorResponse = {
        error: { code: "AI_NOT_CONFIGURED", message: "AI service is not configured" },
      };
      return NextResponse.json(body, { status: 503 });
    }

    try {
      const result = await getIssueById(params.id);
      if (!result.issue) {
        const body: ApiErrorResponse = {
          error: { code: "NOT_FOUND", message: "Issue not found" },
        };
        return NextResponse.json(body, { status: 404 });
      }

      const issue = result.issue;
      const labels = Array.isArray(issue.labels)
        ? (issue.labels as string[])
        : [];

      const analysis = await analyzeIssue({
        title: issue.title,
        body: issue.body,
        labels,
      });

      await updateIssueAIFields(params.id, analysis);

      return NextResponse.json({
        issueId: params.id,
        analysis,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      const body: ApiErrorResponse = {
        error: { code: "ANALYSIS_FAILED", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
