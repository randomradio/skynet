import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { issueCodeContext } from "./schema";

export interface IssueCodeContextRow {
  id: string;
  issueId: string;
  repoOwner: string;
  repoName: string;
  snippets: unknown;
  generatedAt: Date;
}

export async function getCodeContext(
  issueId: string,
): Promise<IssueCodeContextRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(issueCodeContext)
    .where(eq(issueCodeContext.issueId, issueId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCodeContext(input: {
  issueId: string;
  repoOwner: string;
  repoName: string;
  snippets: unknown;
}): Promise<IssueCodeContextRow> {
  const db = getDb();

  // Check if context already exists
  const existing = await getCodeContext(input.issueId);
  if (existing) {
    await db
      .update(issueCodeContext)
      .set({ snippets: input.snippets, generatedAt: new Date() })
      .where(eq(issueCodeContext.id, existing.id));
    return { ...existing, snippets: input.snippets, generatedAt: new Date() };
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(issueCodeContext).values({
    id,
    issueId: input.issueId,
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    snippets: input.snippets,
    generatedAt: now,
  });

  return {
    id,
    issueId: input.issueId,
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    snippets: input.snippets,
    generatedAt: now,
  };
}
