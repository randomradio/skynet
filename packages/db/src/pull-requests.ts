import crypto from "node:crypto";
import { eq, and, sql } from "drizzle-orm";

import { getDb } from "./client";
import { pullRequests } from "./schema";

export interface UpsertPullRequestInput {
  githubId: number;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  headBranch: string;
  baseBranch: string;
  authorGithubId: number | null;
  linkedIssueNumbers: number[];
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  createdAt: Date;
  updatedAt: Date;
  mergedAt: Date | null;
}

export async function upsertPullRequestFromGitHub(
  input: UpsertPullRequestInput,
): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: pullRequests.id })
    .from(pullRequests)
    .where(eq(pullRequests.githubId, input.githubId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pullRequests)
      .set({
        number: input.number,
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        title: input.title,
        body: input.body,
        state: input.state,
        headBranch: input.headBranch,
        baseBranch: input.baseBranch,
        authorGithubId: input.authorGithubId,
        linkedIssueNumbers: input.linkedIssueNumbers,
        additions: input.additions,
        deletions: input.deletions,
        changedFiles: input.changedFiles,
        updatedAt: input.updatedAt,
        mergedAt: input.mergedAt,
        syncedAt: new Date(),
      })
      .where(eq(pullRequests.githubId, input.githubId));
    return existing[0]!.id;
  }

  const id = crypto.randomUUID();
  await db.insert(pullRequests).values({
    id,
    githubId: input.githubId,
    number: input.number,
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    title: input.title,
    body: input.body,
    state: input.state,
    headBranch: input.headBranch,
    baseBranch: input.baseBranch,
    authorGithubId: input.authorGithubId,
    linkedIssueNumbers: input.linkedIssueNumbers,
    additions: input.additions,
    deletions: input.deletions,
    changedFiles: input.changedFiles,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    mergedAt: input.mergedAt,
    syncedAt: new Date(),
  });
  return id;
}

export async function getPullRequestByNumber(
  repoOwner: string,
  repoName: string,
  number: number,
): Promise<typeof pullRequests.$inferSelect | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repoOwner, repoOwner),
        eq(pullRequests.repoName, repoName),
        eq(pullRequests.number, number),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Find PRs that reference a given issue number.
 * Queries the JSON `linkedIssueNumbers` field.
 * Uses LIKE-based matching compatible with MatrixOne (no JSON_CONTAINS).
 */
export async function listPullRequestsByIssueNumber(
  repoOwner: string,
  repoName: string,
  issueNumber: number,
): Promise<Array<typeof pullRequests.$inferSelect>> {
  const db = getDb();
  const numStr = String(issueNumber);

  // Match the number in a JSON array: [N], [N,...], [...,N], [...,N,...]
  return db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repoOwner, repoOwner),
        eq(pullRequests.repoName, repoName),
        sql`(
          CAST(${pullRequests.linkedIssueNumbers} AS VARCHAR) LIKE ${`[${numStr}]`}
          OR CAST(${pullRequests.linkedIssueNumbers} AS VARCHAR) LIKE ${`[${numStr},%`}
          OR CAST(${pullRequests.linkedIssueNumbers} AS VARCHAR) LIKE ${`%,${numStr}]`}
          OR CAST(${pullRequests.linkedIssueNumbers} AS VARCHAR) LIKE ${`%, ${numStr}]`}
          OR CAST(${pullRequests.linkedIssueNumbers} AS VARCHAR) LIKE ${`%,${numStr},%`}
          OR CAST(${pullRequests.linkedIssueNumbers} AS VARCHAR) LIKE ${`%, ${numStr},%`}
        )`,
      ),
    );
}
