import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { listAgentRuns } from "@skynet/db";
import { startAgentRun } from "@/lib/agent/engine";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export const GET = withAuth(
  async (
    request: NextRequest,
  ): Promise<NextResponse> => {
    const url = request.nextUrl;
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const status = url.searchParams.get("status") ?? undefined;
    const issueId = url.searchParams.get("issue_id") ?? undefined;

    const result = await safe(
      () => listAgentRuns({ page, limit, status, issueId }),
      { items: [], page, limit, total: 0 },
    );
    return NextResponse.json(result);
  },
);

export const POST = withAuth(
  async (
    request: NextRequest,
    user: JWTPayload,
  ): Promise<NextResponse> => {
    try {
      const body = await request.json();
      const { issueId, pullRequestId, mode = "develop", options } = body;

      if ((mode === "develop" || mode === "interactive") && !issueId) {
        const errBody: ApiErrorResponse = {
          error: { code: "INVALID_REQUEST", message: "issueId is required for develop/interactive mode" },
        };
        return NextResponse.json(errBody, { status: 400 });
      }

      if (mode === "review" && !pullRequestId) {
        const errBody: ApiErrorResponse = {
          error: { code: "INVALID_REQUEST", message: "pullRequestId is required for review mode" },
        };
        return NextResponse.json(errBody, { status: 400 });
      }

      const userId = typeof user.sub === "string" ? user.sub : "unknown";

      const runId = await startAgentRun({
        issueId,
        pullRequestId,
        mode,
        startedBy: userId,
        options,
      });

      return NextResponse.json({
        id: runId,
        status: "planning",
        issueId: issueId ?? null,
        pullRequestId: pullRequestId ?? null,
        mode,
        startedAt: new Date().toISOString(),
      }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start agent run";
      const body: ApiErrorResponse = {
        error: { code: "AGENT_START_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
