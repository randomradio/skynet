import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { listAgentRuns } from "@skynet/db";
import { startAgentRun } from "@/lib/agent/engine";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(
  async (
    request: NextRequest,
  ): Promise<NextResponse> => {
    const url = request.nextUrl;
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const status = url.searchParams.get("status") ?? undefined;
    const issueId = url.searchParams.get("issue_id") ?? undefined;

    try {
      const result = await listAgentRuns({ page, limit, status, issueId });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list agent runs";
      const body: ApiErrorResponse = {
        error: { code: "LIST_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);

export const POST = withAuth(
  async (
    request: NextRequest,
    user: JWTPayload,
  ): Promise<NextResponse> => {
    try {
      const body = await request.json();
      const { issueId, options } = body;

      if (!issueId) {
        const errBody: ApiErrorResponse = {
          error: { code: "INVALID_REQUEST", message: "issueId is required" },
        };
        return NextResponse.json(errBody, { status: 400 });
      }

      const userId = typeof user.sub === "string" ? user.sub : "unknown";

      const runId = await startAgentRun({
        issueId,
        startedBy: userId,
        options,
      });

      return NextResponse.json({
        id: runId,
        status: "planning",
        issueId,
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
