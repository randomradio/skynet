import crypto from "node:crypto";
import { eq, gt, asc, count } from "drizzle-orm";

import { getDb } from "./client";
import { messages } from "./schema";

export interface InsertMessageInput {
  discussionId: string;
  authorId: string | null;
  authorType: "user" | "ai";
  content: string;
  aiContext?: unknown;
}

export async function insertMessage(input: InsertMessageInput): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(messages).values({
    id,
    discussionId: input.discussionId,
    authorId: input.authorId,
    authorType: input.authorType,
    content: input.content,
    aiContext: input.aiContext ?? null,
    createdAt: new Date(),
  });

  return id;
}

export interface ListMessagesOptions {
  limit?: number;
}

export async function listMessages(
  discussionId: string,
  options: ListMessagesOptions = {},
): Promise<Array<typeof messages.$inferSelect>> {
  const db = getDb();
  const limit = options.limit ?? 50;

  return db
    .select()
    .from(messages)
    .where(eq(messages.discussionId, discussionId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function countMessagesSince(
  discussionId: string,
  since: Date,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ cnt: count() })
    .from(messages)
    .where(
      eq(messages.discussionId, discussionId),
    );

  // Filter by createdAt > since
  const allRows = await db
    .select({ cnt: count() })
    .from(messages)
    .where(eq(messages.discussionId, discussionId));

  // Simple approach: count messages after since date
  const filtered = await db
    .select()
    .from(messages)
    .where(eq(messages.discussionId, discussionId));

  return filtered.filter((m) => m.createdAt > since).length;
}
