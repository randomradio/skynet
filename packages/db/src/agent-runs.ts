import crypto from "node:crypto";
import { count, desc, eq, and, sql, type SQL } from "drizzle-orm";

import { getDb } from "./client";
import { hasDatabaseUrl } from "./env";
import { agentRuns } from "./schema";

export interface AgentLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AgentArtifact {
  type: "diff" | "test_report" | "lint_report" | "file" | "review" | "structured_review";
  path?: string;
  content?: string;
  url?: string;
  // Structured review fields (when type === "structured_review")
  reviewSummary?: string;
  overallAssessment?: "approve" | "request_changes" | "comment";
  findings?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface CreateAgentRunInput {
  issueId?: string;
  pullRequestId?: string;
  mode?: "develop" | "review" | "interactive" | "issue_review";
  startedBy: string;
  workspaceId?: string;
}

export interface AgentRunRow {
  id: string;
  issueId: string | null;
  startedBy: string;
  status: "planning" | "coding" | "testing" | "review" | "waiting_for_input" | "paused" | "cancelled" | "completed" | "failed";
  mode: "develop" | "review" | "interactive" | "issue_review";
  pullRequestId: string | null;
  plan: unknown;
  branch: string | null;
  prNumber: number | null;
  logs: unknown;
  artifacts: unknown;
  workspaceId: string | null;
  bashSessionId: string | null;
  terminalOutput: string | null;
  waitingForInput: boolean;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ListAgentRunsInput {
  page: number;
  limit: number;
  status?: string;
  issueId?: string;
}

export interface ListAgentRunsResult {
  items: AgentRunRow[];
  page: number;
  limit: number;
  total: number;
}

export async function createAgentRun(input: CreateAgentRunInput): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(agentRuns).values({
    id,
    issueId: input.issueId ?? null,
    startedBy: input.startedBy,
    status: "planning",
    mode: input.mode ?? "develop",
    pullRequestId: input.pullRequestId ?? null,
    workspaceId: input.workspaceId ?? null,
    logs: [],
    startedAt: new Date(),
  });

  return id;
}

export async function getAgentRunById(id: string): Promise<AgentRunRow | null> {
  if (!hasDatabaseUrl()) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAgentRunByPRId(pullRequestId: string): Promise<AgentRunRow | null> {
  if (!hasDatabaseUrl()) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.pullRequestId, pullRequestId), eq(agentRuns.mode, "review")))
    .orderBy(desc(agentRuns.startedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function listAgentRuns(input: ListAgentRunsInput): Promise<ListAgentRunsResult> {
  const page = Math.max(1, input.page);
  const limit = Math.min(Math.max(1, input.limit), 100);

  if (!hasDatabaseUrl()) {
    return { items: [], page, limit, total: 0 };
  }

  const db = getDb();
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (input.status) {
    conditions.push(eq(agentRuns.status, input.status as typeof agentRuns.status.enumValues[number]));
  }
  if (input.issueId) {
    conditions.push(eq(agentRuns.issueId, input.issueId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(agentRuns)
    .where(whereClause)
    .orderBy(desc(agentRuns.startedAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ total: count() })
    .from(agentRuns)
    .where(whereClause);

  return {
    items: rows,
    page,
    limit,
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function updateAgentRunStatus(
  id: string,
  status: typeof agentRuns.status.enumValues[number],
): Promise<void> {
  const db = getDb();
  const updates: Record<string, unknown> = { status };

  if (status === "completed" || status === "failed" || status === "cancelled") {
    updates.completedAt = new Date();
  }

  await db.update(agentRuns).set(updates).where(eq(agentRuns.id, id));
}

export async function updateAgentRunPlan(
  id: string,
  plan: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  await db.update(agentRuns).set({ plan }).where(eq(agentRuns.id, id));
}

export async function updateAgentRunBranch(
  id: string,
  branch: string,
  prNumber?: number,
): Promise<void> {
  const db = getDb();
  const updates: Record<string, unknown> = { branch };
  if (prNumber !== undefined) {
    updates.prNumber = prNumber;
  }
  await db.update(agentRuns).set(updates).where(eq(agentRuns.id, id));
}

export async function appendAgentRunLog(
  id: string,
  log: AgentLog,
): Promise<void> {
  const db = getDb();
  const run = await getAgentRunById(id);
  if (!run) return;

  const existingLogs = Array.isArray(run.logs) ? (run.logs as AgentLog[]) : [];
  const updatedLogs = [...existingLogs, log];

  await db.update(agentRuns).set({ logs: updatedLogs }).where(eq(agentRuns.id, id));
}

export async function updateAgentRunArtifacts(
  id: string,
  artifacts: AgentArtifact[],
): Promise<void> {
  const db = getDb();
  await db.update(agentRuns).set({ artifacts }).where(eq(agentRuns.id, id));
}

export async function completeAgentRun(
  id: string,
  result: {
    status: "completed" | "failed";
    branch?: string;
    prNumber?: number;
    artifacts?: AgentArtifact[];
  },
): Promise<void> {
  const db = getDb();
  const existing = await getAgentRunById(id);
  if (!existing) return;

  // Cancellation is terminal and has higher precedence than completion/failure.
  if (existing.status === "cancelled") {
    const cancelledUpdates: Record<string, unknown> = {};
    if (result.artifacts) cancelledUpdates.artifacts = result.artifacts;
    if (Object.keys(cancelledUpdates).length > 0) {
      await db.update(agentRuns).set(cancelledUpdates).where(eq(agentRuns.id, id));
    }
    return;
  }

  const updates: Record<string, unknown> = {
    status: result.status,
    completedAt: new Date(),
  };

  if (result.branch) updates.branch = result.branch;
  if (result.prNumber !== undefined) updates.prNumber = result.prNumber;
  if (result.artifacts) updates.artifacts = result.artifacts;

  await db.update(agentRuns).set(updates).where(eq(agentRuns.id, id));
}

// ─────────────────────────────────────────────────
// Interactive terminal helpers
// ─────────────────────────────────────────────────

export async function setBashSessionId(
  id: string,
  sessionId: string,
): Promise<void> {
  const db = getDb();
  await db.update(agentRuns).set({ bashSessionId: sessionId }).where(eq(agentRuns.id, id));
}

export async function appendTerminalOutput(
  id: string,
  chunk: string,
): Promise<void> {
  const db = getDb();
  await db.update(agentRuns).set({
    terminalOutput: sql`CONCAT(COALESCE(${agentRuns.terminalOutput}, ''), ${chunk})`,
  }).where(eq(agentRuns.id, id));
}

export async function getTerminalOutput(
  id: string,
): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ terminalOutput: agentRuns.terminalOutput })
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .limit(1);
  return rows[0]?.terminalOutput ?? "";
}

export async function setWaitingForInput(
  id: string,
  waiting: boolean,
): Promise<void> {
  const db = getDb();
  await db.update(agentRuns).set({ waitingForInput: waiting }).where(eq(agentRuns.id, id));
}

export async function cancelAgentRun(id: string): Promise<boolean> {
  const run = await getAgentRunById(id);
  if (!run) return false;

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    return false;
  }

  await updateAgentRunStatus(id, "cancelled");
  await setWaitingForInput(id, false);
  await appendAgentRunLog(id, {
    timestamp: new Date().toISOString(),
    level: "info",
    message: "Agent run cancelled by user",
  });
  return true;
}

export async function pauseAgentRun(id: string): Promise<boolean> {
  const run = await getAgentRunById(id);
  if (!run) return false;

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    return false;
  }

  await updateAgentRunStatus(id, "paused");
  await appendAgentRunLog(id, {
    timestamp: new Date().toISOString(),
    level: "info",
    message: "Agent run paused",
  });
  return true;
}
