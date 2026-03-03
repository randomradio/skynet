import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";
import { hasAIConfig } from "@/lib/ai/client";
import { synthesizeDocument } from "@/lib/ai/synthesize";
import {
  getOrCreateDiscussion,
  finalizeDiscussion,
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

    try {
      const discussion = await getOrCreateDiscussion(params.id);

      if (discussion.finalized) {
        const body: ApiErrorResponse = {
          error: { code: "ALREADY_FINALIZED", message: "Discussion is already finalized" },
        };
        return NextResponse.json(body, { status: 409 });
      }

      const issueResult = await getIssueById(params.id);
      const issue = issueResult.issue;
      const msgs = await listMessages(discussion.id, { limit: 50 });

      let finalDocument = discussion.synthesizedDocument ?? "";

      // Try to generate final document via AI, fall back to existing doc on failure
      if (hasAIConfig() && msgs.length > 0) {
        try {
          finalDocument = await synthesizeDocument(
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
        } catch {
          // AI unavailable — finalize with existing document
        }
      }

      await finalizeDiscussion(discussion.id, finalDocument);

      return NextResponse.json({
        discussionId: discussion.id,
        finalized: true,
        document: finalDocument,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Finalization failed";
      const body: ApiErrorResponse = {
        error: { code: "FINALIZE_ERROR", message },
      };
      return NextResponse.json(body, { status: 500 });
    }
  },
);
