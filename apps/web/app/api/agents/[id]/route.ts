import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getAgentRunById } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(
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
      const run = await getAgentRunById(params.id);
      if (!run) {
        const body: ApiErrorResponse = {
          error: { code: "NOT_FOUND", message: "Agent run not found" },
        };
        return NextResponse.json(body, { status: 404 });
      }

      return NextResponse.json({ run });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get agent run";
      const body: ApiErrorResponse = {
        error: { code: "GET_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
