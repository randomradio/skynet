import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getOrCreateDiscussion, listMessages } from "@skynet/db";
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
        error: { code: "INVALID_REQUEST", message: "Issue id is required" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    try {
      const discussion = await getOrCreateDiscussion(params.id);
      const msgs = await listMessages(discussion.id, { limit: 50 });

      return NextResponse.json({
        discussion: {
          id: discussion.id,
          issueId: discussion.issueId,
          type: discussion.type,
          synthesizedDocument: discussion.synthesizedDocument,
          lastSynthesizedAt: discussion.lastSynthesizedAt?.toISOString() ?? null,
          finalized: discussion.finalized,
          finalizedAt: discussion.finalizedAt?.toISOString() ?? null,
          createdAt: discussion.createdAt.toISOString(),
        },
        messages: msgs.map((m) => ({
          id: m.id,
          authorId: m.authorId,
          authorType: m.authorType,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load discussion";
      const body: ApiErrorResponse = {
        error: { code: "DISCUSSION_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
