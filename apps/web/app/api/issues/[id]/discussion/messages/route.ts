import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getOrCreateDiscussion, insertMessage } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const POST = withAuth(
  async (
    request: NextRequest,
    user: JWTPayload,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const params = await context.params;
    if (!params.id) {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "Issue id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    const { content } = await request.json();
    if (!content || typeof content !== "string") {
      const body: ApiErrorResponse = {
        error: { code: "INVALID_REQUEST", message: "content is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      const discussion = await getOrCreateDiscussion(params.id);

      if (discussion.finalized) {
        const body: ApiErrorResponse = {
          error: { code: "DISCUSSION_FINALIZED", message: "Discussion is finalized" },
        };
        return NextResponse.json(body, { status: 409 });
      }

      const messageId = await insertMessage({
        discussionId: discussion.id,
        authorId: (user.sub as string) ?? null,
        authorType: "user",
        content,
      });

      return NextResponse.json({
        message: { id: messageId, content, authorType: "user" },
        aiResponsePending: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post message";
      const body: ApiErrorResponse = {
        error: { code: "MESSAGE_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
