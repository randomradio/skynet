import crypto from "node:crypto";

import { eq } from "drizzle-orm";

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
