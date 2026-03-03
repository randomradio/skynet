import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "./client";
import { discussions } from "./schema";

export async function getOrCreateDiscussion(
  issueId: string,
  type: "issue_chat" | "plan_review" | "code_review" = "issue_chat",
): Promise<typeof discussions.$inferSelect> {
  const db = getDb();

  const existing = await db
    .select()
    .from(discussions)
    .where(eq(discussions.issueId, issueId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0]!;
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(discussions).values({
    id,
    issueId,
    type,
    participants: [],
    synthesizedDocument: null,
    finalized: false,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db
    .select()
    .from(discussions)
    .where(eq(discussions.id, id))
    .limit(1);

  return created[0]!;
}

export async function getDiscussionByIssueId(
  issueId: string,
): Promise<typeof discussions.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(discussions)
    .where(eq(discussions.issueId, issueId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSynthesizedDocument(
  discussionId: string,
  document: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(discussions)
    .set({
      synthesizedDocument: document,
      lastSynthesizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(discussions.id, discussionId));
}

export async function finalizeDiscussion(
  discussionId: string,
  document: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(discussions)
    .set({
      synthesizedDocument: document,
      finalized: true,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(discussions.id, discussionId));
}
