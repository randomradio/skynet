import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "./client";
import { webhookEvents } from "./schema";

export interface InsertWebhookEventInput {
  id?: string;
  source: string;
  eventType: string;
  payload: unknown;
}

export async function insertWebhookEvent(input: InsertWebhookEventInput): Promise<string> {
  const db = getDb();
  const id = input.id ?? crypto.randomUUID();

  await db.insert(webhookEvents).values({
    id,
    source: input.source,
    eventType: input.eventType,
    payload: input.payload,
    processed: false,
    createdAt: new Date(),
  });

  return id;
}

export async function findWebhookEventById(
  id: string,
): Promise<typeof webhookEvents.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function markWebhookEventProcessed(
  id: string,
  error?: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(webhookEvents)
    .set({
      processed: true,
      processedAt: new Date(),
      errorMessage: error ?? null,
    })
    .where(eq(webhookEvents.id, id));
}
