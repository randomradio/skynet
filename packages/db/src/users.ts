import crypto from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { users } from "./schema";

export interface UpsertUserInput {
  githubId: number;
  username: string;
  avatarUrl: string | null;
}

export interface UpsertUserResult {
  id: string;
  githubId: number;
  username: string;
  source: "database" | "not_configured";
}

export async function upsertUser(input: UpsertUserInput): Promise<UpsertUserResult> {
  if (!hasDatabaseUrl()) {
    return {
      id: "",
      githubId: input.githubId,
      username: input.username,
      source: "not_configured",
    };
  }

  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.githubId, input.githubId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        username: input.username,
        avatarUrl: input.avatarUrl,
        lastLoginAt: new Date(),
      })
      .where(eq(users.githubId, input.githubId));

    return {
      id: existing[0]!.id,
      githubId: input.githubId,
      username: input.username,
      source: "database",
    };
  }

  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    githubId: input.githubId,
    username: input.username,
    avatarUrl: input.avatarUrl,
    role: "engineer",
    createdAt: new Date(),
    lastLoginAt: new Date(),
  });

  return {
    id,
    githubId: input.githubId,
    username: input.username,
    source: "database",
  };
}

export interface UserProfile {
  id: string;
  githubId: number;
  username: string;
  avatarUrl: string | null;
}

export async function getUsersByGithubIds(
  ids: number[],
): Promise<Map<number, UserProfile>> {
  if (ids.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      githubId: users.githubId,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.githubId, ids));

  const map = new Map<number, UserProfile>();
  for (const row of rows) {
    map.set(row.githubId, row);
  }
  return map;
}

export async function searchUsers(
  query: string,
  limit = 10,
): Promise<UserProfile[]> {
  const db = getDb();
  return db
    .select({
      id: users.id,
      githubId: users.githubId,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(like(users.username, `%${query}%`))
    .limit(limit);
}
