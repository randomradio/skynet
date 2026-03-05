import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./client";
import { reviewFeedback } from "./schema";

export interface ReviewFeedbackRow {
  id: string;
  agentRunId: string;
  findingId: string;
  action: string;
  comment: string | null;
  createdBy: string;
  createdAt: Date;
}

export async function insertFeedback(input: {
  agentRunId: string;
  findingId: string;
  action: string;
  comment?: string;
  createdBy: string;
}): Promise<ReviewFeedbackRow> {
  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(reviewFeedback).values({
    id,
    agentRunId: input.agentRunId,
    findingId: input.findingId,
    action: input.action,
    comment: input.comment ?? null,
    createdBy: input.createdBy,
    createdAt: new Date(),
  });

  return {
    id,
    agentRunId: input.agentRunId,
    findingId: input.findingId,
    action: input.action,
    comment: input.comment ?? null,
    createdBy: input.createdBy,
    createdAt: new Date(),
  };
}

export async function listFeedbackByAgentRun(
  agentRunId: string,
): Promise<ReviewFeedbackRow[]> {
  const db = getDb();
  return db
    .select()
    .from(reviewFeedback)
    .where(eq(reviewFeedback.agentRunId, agentRunId));
}

export async function deleteFeedback(id: string): Promise<void> {
  const db = getDb();
  await db.delete(reviewFeedback).where(eq(reviewFeedback.id, id));
}
