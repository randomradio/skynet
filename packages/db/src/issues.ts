import { count, desc, eq } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { issues } from "./schema";

export interface ListIssuesInput {
  page: number;
  limit: number;
}

export interface IssueListItem {
  id: string;
  title: string;
  state: "open" | "closed";
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

export async function listIssuesPage(input: ListIssuesInput): Promise<ListIssuesResult> {
  const { page, limit } = normalizePaging(input);

  if (!hasDatabaseUrl()) {
    return {
      items: [],
      page,
      limit,
      total: 0,
      source: "not_configured",
    };
  }

  const db = getDb();
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      state: issues.state,
    })
    .from(issues)
    .orderBy(desc(issues.updatedAt), desc(issues.syncedAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db.select({ total: count() }).from(issues);

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
    return {
      issue: null,
      source: "not_configured",
    };
  }

  const db = getDb();
  const rows = await db
    .select({
      id: issues.id,
      githubId: issues.githubId,
      number: issues.number,
      repoOwner: issues.repoOwner,
      repoName: issues.repoName,
      title: issues.title,
      body: issues.body,
      state: issues.state,
      labels: issues.labels,
      aiType: issues.aiType,
      aiPriority: issues.aiPriority,
      aiSummary: issues.aiSummary,
      aiTags: issues.aiTags,
      aiAnalysis: issues.aiAnalysis,
      duplicateOf: issues.duplicateOf,
      relatedIssues: issues.relatedIssues,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      syncedAt: issues.syncedAt,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  return {
    issue: rows[0] ?? null,
    source: "database",
  };
}
