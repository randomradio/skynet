import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { getAgentRunsByPullRequest } from "@/lib/agent/get-review";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(async (
  _request: NextRequest,
  _user,
  context: { params: Promise<Record<string, string>> },
): Promise<NextResponse> => {
  const { owner, name, number: numStr } = await context.params;
  const prNumber = Number.parseInt(numStr, 10);

  if (Number.isNaN(prNumber)) {
    const body: ApiErrorResponse = {
      error: { code: "BAD_REQUEST", message: "Invalid pull request number" },
    };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    const review = await getAgentRunsByPullRequest(owner, name, prNumber);
    return NextResponse.json({ review });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch review";
    const body: ApiErrorResponse = {
      error: { code: "REVIEW_ERROR", message },
    };
    return NextResponse.json(body, { status: 500 });
  }
});
