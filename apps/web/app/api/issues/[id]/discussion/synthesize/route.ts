import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { hasAIConfig } from "@/lib/ai/client";
import { synthesizeDocument } from "@/lib/ai/synthesize";
import {
  getOrCreateDiscussion,
  updateSynthesizedDocument,
  listMessages,
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
      const issueResult = await getIssueById(params.id);
      const issue = issueResult.issue;
      const msgs = await listMessages(discussion.id, { limit: 50 });

      if (msgs.length === 0) {
        return NextResponse.json({
          document: discussion.synthesizedDocument ?? "",
          message: "No messages to synthesize",
        });
      }

      const document = await synthesizeDocument(
        msgs.map((m) => ({
          role: m.authorType as "user" | "ai",
          content: m.content,
        })),
        discussion.synthesizedDocument,
        {
          issueTitle: issue?.title ?? "",
          issueBody: issue?.body ?? null,
        },
      );

      await updateSynthesizedDocument(discussion.id, document);

      return NextResponse.json({ document });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Synthesis failed";
      const body: ApiErrorResponse = {
        error: { code: "SYNTHESIS_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
