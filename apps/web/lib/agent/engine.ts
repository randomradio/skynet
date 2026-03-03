import {
  createAgentRun,
  getAgentRunById,
  updateAgentRunStatus,
  updateAgentRunPlan,
  appendAgentRunLog,
  completeAgentRun,
  getIssueById,
  getDiscussionByIssueId,
  type AgentLog,
  type AgentArtifact,
} from "@skynet/db";
import { hasAIConfig } from "@/lib/ai/client";
import { generateImplementationPlan } from "@/lib/ai/generate-plan";
import { generateCode, type CodeGenerationResult } from "@/lib/ai/generate-code";

export interface StartAgentRunInput {
  issueId: string;
  startedBy: string;
  options?: {
    autoCreatePR?: boolean;
    runTests?: boolean;
  };
}

export interface AgentProgressCallback {
  (log: AgentLog): void;
}

// In-memory map of running agents for cancellation
const runningAgents = new Map<string, { cancelled: boolean }>();

export function isAgentRunning(runId: string): boolean {
  return runningAgents.has(runId);
}

export function requestCancellation(runId: string): boolean {
  const state = runningAgents.get(runId);
  if (state) {
    state.cancelled = true;
    return true;
  }
  return false;
}

async function log(
  runId: string,
  level: AgentLog["level"],
  message: string,
  metadata?: Record<string, unknown>,
  onProgress?: AgentProgressCallback,
): Promise<void> {
  const entry: AgentLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };
  await appendAgentRunLog(runId, entry);
  onProgress?.(entry);
}

function checkCancelled(runId: string): boolean {
  const state = runningAgents.get(runId);
  return state?.cancelled ?? false;
}

export async function startAgentRun(
  input: StartAgentRunInput,
  onProgress?: AgentProgressCallback,
): Promise<string> {
  // Validate issue exists
  const issueResult = await getIssueById(input.issueId);
  if (!issueResult.issue) {
    throw new Error("Issue not found");
  }

  if (!hasAIConfig()) {
    throw new Error("AI configuration (AI_API_KEY) is required for agent runs");
  }

  const issue = issueResult.issue;

  // Create agent run record
  const runId = await createAgentRun({
    issueId: input.issueId,
    startedBy: input.startedBy,
  });

  // Track running state
  const agentState = { cancelled: false };
  runningAgents.set(runId, agentState);

  // Execute agent asynchronously (fire-and-forget)
  void executeAgent(runId, issue, input.options, onProgress).finally(() => {
    runningAgents.delete(runId);
  });

  return runId;
}

async function executeAgent(
  runId: string,
  issue: {
    id: string;
    title: string;
    body: string | null;
    repoOwner: string;
    repoName: string;
    aiSummary: string | null;
    aiType: "bug" | "feature" | "task" | "question" | null;
    aiPriority: "P0" | "P1" | "P2" | "P3" | null;
  },
  options?: { autoCreatePR?: boolean; runTests?: boolean },
  onProgress?: AgentProgressCallback,
): Promise<void> {
  try {
    // ── Phase 1: Planning ──
    await log(runId, "info", "Starting implementation planning...", undefined, onProgress);

    if (checkCancelled(runId)) {
      await handleCancellation(runId, onProgress);
      return;
    }

    // Load discussion document if available
    let discussionDocument: string | null = null;
    try {
      const discussion = await getDiscussionByIssueId(issue.id);
      if (discussion?.synthesizedDocument) {
        discussionDocument = discussion.synthesizedDocument;
        await log(runId, "info", "Loaded discussion document for context", undefined, onProgress);
      }
    } catch {
      // No discussion — that's fine
    }

    const plan = await generateImplementationPlan({
      issueTitle: issue.title,
      issueBody: issue.body,
      aiSummary: issue.aiSummary,
      aiType: issue.aiType,
      aiPriority: issue.aiPriority,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
      discussionDocument,
    });

    await updateAgentRunPlan(runId, plan as unknown as Record<string, unknown>);
    await log(
      runId,
      "info",
      `Plan generated: ${plan.summary}`,
      {
        filesCount: plan.files.length,
        testsCount: plan.tests.length,
        complexity: plan.estimatedComplexity,
      },
      onProgress,
    );

    if (plan.files.length === 0) {
      await log(runId, "warn", "Plan produced no file changes — completing with review status", undefined, onProgress);
      await completeAgentRun(runId, {
        status: "completed",
        artifacts: [{ type: "diff", content: "No changes generated" }],
      });
      return;
    }

    if (checkCancelled(runId)) {
      await handleCancellation(runId, onProgress);
      return;
    }

    // ── Phase 2: Code Generation ──
    await updateAgentRunStatus(runId, "coding");
    await log(
      runId,
      "info",
      `Generating code for ${plan.files.length} file(s)...`,
      { files: plan.files.map((f) => f.path) },
      onProgress,
    );

    let codeResult: CodeGenerationResult;
    try {
      codeResult = await generateCode({
        issueTitle: issue.title,
        issueBody: issue.body,
        plan,
        repoOwner: issue.repoOwner,
        repoName: issue.repoName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Code generation failed";
      await log(runId, "error", `Code generation failed: ${message}`, undefined, onProgress);
      await completeAgentRun(runId, { status: "failed" });
      return;
    }

    if (codeResult.files.length === 0) {
      await log(runId, "warn", "Code generation produced no files", undefined, onProgress);
      await completeAgentRun(runId, {
        status: "failed",
        artifacts: [{ type: "diff", content: "No code generated" }],
      });
      return;
    }

    await log(
      runId,
      "info",
      `Generated ${codeResult.files.length} file(s)`,
      { files: codeResult.files.map((f) => `${f.action} ${f.path}`) },
      onProgress,
    );

    if (checkCancelled(runId)) {
      await handleCancellation(runId, onProgress);
      return;
    }

    // ── Phase 3: Testing (placeholder) ──
    if (options?.runTests !== false) {
      await updateAgentRunStatus(runId, "testing");
      await log(runId, "info", "Testing phase — skipped (no sandbox environment)", undefined, onProgress);
    }

    // ── Phase 4: Review ──
    await updateAgentRunStatus(runId, "review");

    const artifacts: AgentArtifact[] = codeResult.files.map((f) => ({
      type: "diff" as const,
      path: f.path,
      content: f.content,
    }));

    await log(
      runId,
      "info",
      `Agent completed — ${codeResult.files.length} file(s) ready for review`,
      { commitMessage: codeResult.commitMessage },
      onProgress,
    );

    // ── Phase 5: Branch + PR (if configured) ──
    let branch: string | undefined;
    let prNumber: number | undefined;

    if (options?.autoCreatePR && process.env.GITHUB_TOKEN) {
      try {
        const branchName = `agent/issue-${issue.repoOwner}-${issue.repoName}-${Date.now()}`;
        await log(runId, "info", `Would create branch: ${branchName}`, undefined, onProgress);
        // PR creation requires write access via GitHub API — staged for Docker sandbox
        branch = branchName;
      } catch (err) {
        const message = err instanceof Error ? err.message : "PR creation failed";
        await log(runId, "warn", `PR creation skipped: ${message}`, undefined, onProgress);
      }
    }

    await completeAgentRun(runId, {
      status: "completed",
      branch,
      prNumber,
      artifacts,
    });

    await log(runId, "info", "Agent run completed successfully", undefined, onProgress);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await log(runId, "error", `Agent run failed: ${message}`, undefined, onProgress);

    try {
      await completeAgentRun(runId, { status: "failed" });
    } catch {
      // Best-effort status update
    }
  }
}

async function handleCancellation(
  runId: string,
  onProgress?: AgentProgressCallback,
): Promise<void> {
  await log(runId, "info", "Agent run cancelled", undefined, onProgress);
  await updateAgentRunStatus(runId, "cancelled");
}

/**
 * Get the latest logs for a running agent (poll-based).
 * Returns logs added since the given index.
 */
export async function getAgentRunLogsSince(
  runId: string,
  sinceIndex: number,
): Promise<AgentLog[]> {
  const run = await getAgentRunById(runId);
  if (!run) return [];

  const allLogs = Array.isArray(run.logs) ? (run.logs as AgentLog[]) : [];
  return allLogs.slice(sinceIndex);
}
