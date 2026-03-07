import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { repositories } from "./schema";

export interface UpsertRepositoryInput {
  githubId: number;
  owner: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
}

export async function upsertRepository(input: UpsertRepositoryInput): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.githubId, input.githubId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(repositories)
      .set({
        owner: input.owner,
        name: input.name,
        description: input.description,
        isPrivate: input.isPrivate,
        defaultBranch: input.defaultBranch,
        updatedAt: new Date(),
      })
      .where(eq(repositories.githubId, input.githubId));
    return existing[0]!.id;
  }

  const id = crypto.randomUUID();
  await db.insert(repositories).values({
    id,
    githubId: input.githubId,
    owner: input.owner,
    name: input.name,
    description: input.description,
    isPrivate: input.isPrivate,
    defaultBranch: input.defaultBranch,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function getRepositoryById(
  id: string,
): Promise<typeof repositories.$inferSelect | null> {
  if (!hasDatabaseUrl()) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRepositoryByOwnerName(
  owner: string,
  name: string,
): Promise<typeof repositories.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.owner, owner), eq(repositories.name, name)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRepositories(): Promise<Array<typeof repositories.$inferSelect>> {
  if (!hasDatabaseUrl()) return [];
  const db = getDb();
  return db.select().from(repositories);
}

export async function touchRepositorySyncTimestamp(
  owner: string,
  name: string,
): Promise<void> {
  if (!hasDatabaseUrl()) return;
  const db = getDb();
  await db
    .update(repositories)
    .set({
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(repositories.owner, owner), eq(repositories.name, name)));
}
