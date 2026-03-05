import { eq, and, sql, lte, type SQL } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { issueWorkspaces } from "./schema";

/** Returns true when the error indicates the issue_workspaces table doesn't exist yet. */
function isTableMissingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  // MySQL/MatrixOne: "Table '…' doesn't exist" (errno 1146)
  return msg.includes("doesn't exist") || msg.includes("ER_NO_SUCH_TABLE");
}

export interface WorkspaceRow {
  id: string;
  issueId: string;
  status: "active" | "paused" | "completed" | "expired";
  repoPath: string;
  worktreePath: string;
  branch: string;
  createdBy: string;
  assignedTo: string | null;
  activeRunId: string | null;
  sessionCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspaceInput {
  id: string;
  issueId: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  createdBy: string;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<void> {
  const db = getDb();
  await db.insert(issueWorkspaces).values({
    id: input.id,
    issueId: input.issueId,
    status: "paused",
    repoPath: input.repoPath,
    worktreePath: input.worktreePath,
    branch: input.branch,
    createdBy: input.createdBy,
    assignedTo: input.createdBy,
    sessionCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getWorkspaceByIssueId(issueId: string): Promise<WorkspaceRow | null> {
  if (!hasDatabaseUrl()) return null;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(issueWorkspaces)
      .where(
        and(
          eq(issueWorkspaces.issueId, issueId),
          sql`${issueWorkspaces.status} IN ('active', 'paused')`,
        ),
      )
      .limit(1);
    return (rows[0] as WorkspaceRow) ?? null;
  } catch (err) {
    if (isTableMissingError(err)) return null;
    throw err;
  }
}

export async function getWorkspaceById(id: string): Promise<WorkspaceRow | null> {
  if (!hasDatabaseUrl()) return null;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(issueWorkspaces)
      .where(eq(issueWorkspaces.id, id))
      .limit(1);
    return (rows[0] as WorkspaceRow) ?? null;
  } catch (err) {
    if (isTableMissingError(err)) return null;
    throw err;
  }
}

export async function activateWorkspace(
  id: string,
  runId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(issueWorkspaces)
    .set({
      status: "active",
      activeRunId: runId,
      assignedTo: userId,
      sessionCount: sql`${issueWorkspaces.sessionCount} + 1`,
      expiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(issueWorkspaces.id, id));
}

export async function pauseWorkspace(
  id: string,
  expiresInHours = 24,
): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  await db
    .update(issueWorkspaces)
    .set({
      status: "paused",
      activeRunId: null,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(issueWorkspaces.id, id));
}

export async function completeWorkspace(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(issueWorkspaces)
    .set({
      status: "completed",
      activeRunId: null,
      expiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(issueWorkspaces.id, id));
}

export async function acquireWorkspaceLock(
  id: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  // Only lock if status is "paused" (no one else is active)
  const result = await db
    .update(issueWorkspaces)
    .set({
      status: "active",
      assignedTo: userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(issueWorkspaces.id, id),
        eq(issueWorkspaces.status, "paused"),
      ),
    );
  // If affected rows > 0, we acquired the lock
  return (result as unknown as [{ affectedRows: number }])[0]?.affectedRows > 0;
}

export async function releaseWorkspaceLock(id: string): Promise<void> {
  await pauseWorkspace(id);
}

export async function listWorkspaces(filters?: {
  status?: string;
  assignedTo?: string;
}): Promise<WorkspaceRow[]> {
  if (!hasDatabaseUrl()) return [];
  try {
    const db = getDb();
    const conditions: SQL[] = [];

    if (filters?.status) {
      conditions.push(
        eq(issueWorkspaces.status, filters.status as typeof issueWorkspaces.status.enumValues[number]),
      );
    }
    if (filters?.assignedTo) {
      conditions.push(eq(issueWorkspaces.assignedTo, filters.assignedTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(issueWorkspaces)
      .where(whereClause);
    return rows as WorkspaceRow[];
  } catch (err) {
    if (isTableMissingError(err)) return [];
    throw err;
  }
}

export async function listExpiredWorkspaces(): Promise<WorkspaceRow[]> {
  if (!hasDatabaseUrl()) return [];
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(issueWorkspaces)
      .where(
        and(
          eq(issueWorkspaces.status, "paused"),
          lte(issueWorkspaces.expiresAt, new Date()),
        ),
      );
    return rows as WorkspaceRow[];
  } catch (err) {
    if (isTableMissingError(err)) return [];
    throw err;
  }
}

export async function expireWorkspace(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(issueWorkspaces)
    .set({
      status: "expired",
      activeRunId: null,
      updatedAt: new Date(),
    })
    .where(eq(issueWorkspaces.id, id));
}

export async function reassignWorkspace(
  id: string,
  assignTo: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(issueWorkspaces)
    .set({
      assignedTo: assignTo,
      updatedAt: new Date(),
    })
    .where(eq(issueWorkspaces.id, id));
}
