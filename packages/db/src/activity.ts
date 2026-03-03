import crypto from "node:crypto";
import { desc, lt } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { activityLog } from "./schema";

export interface InsertActivityInput {
  type: (typeof activityLog.$inferInsert)["type"];
  repoOwner?: string;
  repoName?: string;
  issueNumber?: number;
  agentRunId?: string;
  actorId?: string;
  actorType: "user" | "ai" | "system";
  title: string;
  description?: string;
  metadata?: unknown;
}

export async function insertActivity(input: InsertActivityInput): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(activityLog).values({
    id,
    type: input.type,
    repoOwner: input.repoOwner ?? null,
    repoName: input.repoName ?? null,
    issueNumber: input.issueNumber ?? null,
    agentRunId: input.agentRunId ?? null,
    actorId: input.actorId ?? null,
    actorType: input.actorType,
    title: input.title,
    description: input.description ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  });

  return id;
}

export interface ListActivitiesOptions {
  limit?: number;
  before?: string; // ISO date cursor
}

export async function listActivities(
  options: ListActivitiesOptions = {},
): Promise<Array<typeof activityLog.$inferSelect>> {
  if (!hasDatabaseUrl()) return [];

  const db = getDb();
  const limit = Math.min(options.limit ?? 20, 100);

  if (options.before) {
    const cursor = new Date(options.before);
    return db
      .select()
      .from(activityLog)
      .where(lt(activityLog.createdAt, cursor))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}
