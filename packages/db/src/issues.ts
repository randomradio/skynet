import crypto from "node:crypto";
import { count, desc, eq, and, sql, type SQL } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { issues } from "./schema";

export interface ListIssuesInput {
  page: number;
  limit: number;
  state?: "open" | "closed";
  aiType?: "bug" | "feature" | "task" | "question";
  aiPriority?: "P0" | "P1" | "P2" | "P3";
  repoOwner?: string;
  repoName?: string;
}

export interface IssueListItem {
  id: string;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  state: "open" | "closed";
  labels: unknown;
  aiType: "bug" | "feature" | "task" | "question" | null;
  aiPriority: "P0" | "P1" | "P2" | "P3" | null;
  aiSummary: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ListIssuesResult {
  items: IssueListItem[];
  page: number;
  limit: number;
  total: number;
  source: "database" | "not_configured";
}

export interface IssueDetail {
  id: string;
  githubId: number;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: unknown;
  aiType: "bug" | "feature" | "task" | "question" | null;
  aiPriority: "P0" | "P1" | "P2" | "P3" | null;
  aiSummary: string | null;
  aiTags: unknown;
  aiAnalysis: unknown;
  duplicateOf: number | null;
  relatedIssues: unknown;
  lastAnalyzedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  syncedAt: Date;
}

export interface GetIssueByIdResult {
  issue: IssueDetail | null;
  source: "database" | "not_configured";
}

function normalizePaging(input: ListIssuesInput): { page: number; limit: number } {
  const normalizedPage = Number.isNaN(input.page) || input.page < 1 ? 1 : input.page;
  const normalizedLimit =
    Number.isNaN(input.limit) || input.limit < 1 ? 20 : Math.min(input.limit, 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  };
}

function buildFilters(input: ListIssuesInput): SQL[] {
  const conditions: SQL[] = [];
  if (input.state) conditions.push(eq(issues.state, input.state));
  if (input.aiType) conditions.push(eq(issues.aiType, input.aiType));
  if (input.aiPriority) conditions.push(eq(issues.aiPriority, input.aiPriority));
  if (input.repoOwner) conditions.push(eq(issues.repoOwner, input.repoOwner));
  if (input.repoName) conditions.push(eq(issues.repoName, input.repoName));
  return conditions;
}

export async function listIssuesPage(input: ListIssuesInput): Promise<ListIssuesResult> {
  const { page, limit } = normalizePaging(input);

  if (!hasDatabaseUrl()) {
    return { items: [], page, limit, total: 0, source: "not_configured" };
  }

  const db = getDb();
  const offset = (page - 1) * limit;
  const conditions = buildFilters(input);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: issues.id,
      number: issues.number,
      repoOwner: issues.repoOwner,
      repoName: issues.repoName,
      title: issues.title,
      state: issues.state,
      labels: issues.labels,
      aiType: issues.aiType,
      aiPriority: issues.aiPriority,
      aiSummary: issues.aiSummary,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
    })
    .from(issues)
    .where(whereClause)
    .orderBy(desc(issues.updatedAt), desc(issues.syncedAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ total: count() })
    .from(issues)
    .where(whereClause);

  return {
    items: rows,
    page,
    limit,
    total: Number(countRows[0]?.total ?? 0),
    source: "database",
  };
}

export async function getIssueById(issueId: string): Promise<GetIssueByIdResult> {
  if (!hasDatabaseUrl()) {
    return { issue: null, source: "not_configured" };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  return {
    issue: rows[0] ?? null,
    source: "database",
  };
}

export async function getIssueByNumber(
  repoOwner: string,
  repoName: string,
  number: number,
): Promise<IssueDetail | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.repoOwner, repoOwner),
        eq(issues.repoName, repoName),
        eq(issues.number, number),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface UpsertIssueFromGitHubInput {
  githubId: number;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: string[];
  assigneeGithubId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function upsertIssueFromGitHub(input: UpsertIssueFromGitHubInput): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.githubId, input.githubId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(issues)
      .set({
        number: input.number,
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        title: input.title,
        body: input.body,
        state: input.state,
        labels: input.labels,
        assigneeGithubId: input.assigneeGithubId,
        updatedAt: input.updatedAt,
        syncedAt: new Date(),
      })
      .where(eq(issues.githubId, input.githubId));
    return existing[0]!.id;
  }

  const id = crypto.randomUUID();
  await db.insert(issues).values({
    id,
    githubId: input.githubId,
    number: input.number,
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    title: input.title,
    body: input.body,
    state: input.state,
    labels: input.labels,
    assigneeGithubId: input.assigneeGithubId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    syncedAt: new Date(),
  });
  return id;
}

export interface UpdateIssueAIFieldsInput {
  aiType: "bug" | "feature" | "task" | "question";
  aiPriority: "P0" | "P1" | "P2" | "P3";
  aiSummary: string;
  aiTags: string[];
  aiAnalysis: Record<string, unknown>;
}

export async function updateIssueAIFields(
  issueId: string,
  fields: UpdateIssueAIFieldsInput,
): Promise<void> {
  const db = getDb();
  await db
    .update(issues)
    .set({
      aiType: fields.aiType,
      aiPriority: fields.aiPriority,
      aiSummary: fields.aiSummary,
      aiTags: fields.aiTags,
      aiAnalysis: fields.aiAnalysis,
      lastAnalyzedAt: new Date(),
    })
    .where(eq(issues.id, issueId));
}

export async function countIssuesByState(): Promise<{ open: number; closed: number }> {
  if (!hasDatabaseUrl()) return { open: 0, closed: 0 };

  const db = getDb();
  const rows = await db
    .select({
      state: issues.state,
      cnt: count(),
    })
    .from(issues)
    .groupBy(issues.state);

  const result = { open: 0, closed: 0 };
  for (const row of rows) {
    if (row.state === "open") result.open = Number(row.cnt);
    if (row.state === "closed") result.closed = Number(row.cnt);
  }
  return result;
}

export async function countIssuesByPriority(): Promise<Record<string, number>> {
  if (!hasDatabaseUrl()) return {};

  const db = getDb();
  const rows = await db
    .select({
      priority: issues.aiPriority,
      cnt: count(),
    })
    .from(issues)
    .where(sql`${issues.aiPriority} IS NOT NULL`)
    .groupBy(issues.aiPriority);

  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.priority) result[row.priority] = Number(row.cnt);
  }
  return result;
}
