import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { cancelAgentRun } from "@skynet/db";
import { requestCancellation } from "@/lib/agent/engine";
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
        error: { code: "INVALID_REQUEST", message: "Agent run id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      // Request in-memory cancellation for running agents
      requestCancellation(params.id);

      // Also cancel in DB
      const cancelled = await cancelAgentRun(params.id);
      if (!cancelled) {
        const body: ApiErrorResponse = {
          error: {
            code: "CANCEL_FAILED",
            message: "Agent run not found or already in a terminal state",
          },
        };
        return NextResponse.json(body, { status: 409 });
      }

      return NextResponse.json({ id: params.id, status: "cancelled" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel agent run";
      const body: ApiErrorResponse = {
        error: { code: "CANCEL_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
