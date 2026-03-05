import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { getOrCreateDiscussion, insertMessage, addParticipant } from "@skynet/db";
import { triggerAIResponse } from "@/lib/ai/auto-respond";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

const AI_MENTION_PATTERN = /(?:^|[\s,.!?])@(ai|skynet)\b/i;

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

    const { content, parentId } = await request.json();
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
        parentId: parentId ?? undefined,
      });

      // Add user as participant (fire-and-forget)
      const username = (user as Record<string, unknown>).username as string | undefined;
      const avatarUrl = (user as Record<string, unknown>).avatar_url as string | undefined;
      const githubIdStr = (user.sub as string) ?? "";
      const githubIdMatch = githubIdStr.match(/^github:(\d+)$/);
      if (githubIdMatch && username) {
        addParticipant(discussion.id, {
          githubId: parseInt(githubIdMatch[1]!, 10),
          username,
          avatarUrl: avatarUrl ?? null,
        }).catch(() => {});
      }

      // Only trigger AI when explicitly @mentioned
      const shouldTriggerAI = AI_MENTION_PATTERN.test(content);

      if (shouldTriggerAI) {
        triggerAIResponse(params.id, parentId ?? undefined).catch((err) => {
          console.error("[skynet] auto AI response failed:", err);
        });
      }

      return NextResponse.json({
        message: {
          id: messageId,
          content,
          authorType: "user",
          parentId: parentId ?? null,
        },
        aiResponsePending: shouldTriggerAI,
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
