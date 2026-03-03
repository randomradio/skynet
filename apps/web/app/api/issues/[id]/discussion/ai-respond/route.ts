import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { hasAIConfig } from "@/lib/ai/client";
import { streamAIChatResponse } from "@/lib/ai/chat";
import { synthesizeDocument } from "@/lib/ai/synthesize";
import {
  getOrCreateDiscussion,
  listMessages,
  insertMessage,
  updateSynthesizedDocument,
  getIssueById,
} from "@skynet/db";
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
      const discussion = await getOrCreateDiscussion(params.id);

      if (discussion.finalized) {
        const body: ApiErrorResponse = {
          error: { code: "DISCUSSION_FINALIZED", message: "Discussion is finalized" },
        };
        return NextResponse.json(body, { status: 409 });
      }

      const issueResult = await getIssueById(params.id);
      const issue = issueResult.issue;
      const msgs = await listMessages(discussion.id, { limit: 50 });

      const chatMessages = msgs.map((m) => ({
        role: m.authorType as "user" | "ai",
        content: m.content,
        authorId: m.authorId,
      }));

      const stream = streamAIChatResponse({
        messages: chatMessages,
        synthesizedDocument: discussion.synthesizedDocument,
        issueTitle: issue?.title ?? "Unknown issue",
        issueBody: issue?.body ?? null,
      });

      let fullContent = "";

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of stream) {
              fullContent += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`),
              );
            }

            // Save the complete AI message
            const messageId = await insertMessage({
              discussionId: discussion.id,
              authorId: null,
              authorType: "ai",
              content: fullContent,
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, messageId })}\n\n`,
              ),
            );

            // Auto-synthesize after 3+ messages since last synthesis
            const recentMsgs = await listMessages(discussion.id, { limit: 50 });
            const sinceLastSynthesis = discussion.lastSynthesizedAt
              ? recentMsgs.filter((m) => m.createdAt > discussion.lastSynthesizedAt!).length
              : recentMsgs.length;

            if (sinceLastSynthesis >= 3) {
              // Fire and forget
              synthesizeDocument(
                recentMsgs.map((m) => ({
                  role: m.authorType as "user" | "ai",
                  content: m.content,
                })),
                discussion.synthesizedDocument,
                {
                  issueTitle: issue?.title ?? "",
                  issueBody: issue?.body ?? null,
                },
              )
                .then((doc) => updateSynthesizedDocument(discussion.id, doc))
                .catch(() => {});
            }

            controller.close();
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Stream error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
            );
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI response failed";
      const body: ApiErrorResponse = {
        error: { code: "AI_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
