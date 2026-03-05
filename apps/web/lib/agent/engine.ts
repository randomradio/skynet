import crypto from "node:crypto";
import {
  createAgentRun,
  getAgentRunById,
  updateAgentRunStatus,
  updateAgentRunPlan,
  appendAgentRunLog,
  appendTerminalOutput,
  completeAgentRun,
  pauseAgentRun,
  getIssueById,
  getDiscussionByIssueId,
  getPullRequestById,
  getWorkspaceById,
  pauseWorkspace,
  type AgentLog,
  type AgentArtifact,
} from "@skynet/db";
import { hasAIConfig } from "@/lib/ai/client";
import { generateImplementationPlan } from "@/lib/ai/generate-plan";
import { generateCode, type CodeGenerationResult } from "@/lib/ai/generate-code";
import {
  getSandbox,
  isSandboxAvailable,
  ensureRepoCloned,
  fetchLatest,
  createWorktree,
  cleanupWorktree,
  getDiffStats,
  getFileTree,
  readFiles,
  findRelevantFiles,
} from "@/lib/sandbox";
import { executeInteractiveAgent } from "./interactive-engine";
import type { TerminalSession } from "./terminal-session";

export interface StartAgentRunInput {
  issueId?: string;
  pullRequestId?: string;
  mode: "develop" | "review" | "interactive";
  startedBy: string;
  workspaceId?: string;
  options?: {
    autoCreatePR?: boolean;
    runTests?: boolean;
    tool?: string;
  };
}

export interface AgentProgressCallback {
  (log: AgentLog): void;
}

// In-memory map of running agents for cancellation
const runningAgents = new Map<
  string,
  { cancelled: boolean; terminalSession?: TerminalSession }
>();

export function isAgentRunning(runId: string): boolean {
  return runningAgents.has(runId);
}

export function getTerminalSession(runId: string): TerminalSession | undefined {
  return runningAgents.get(runId)?.terminalSession;
}

export function requestCancellation(runId: string): boolean {
  const state = runningAgents.get(runId);
  if (state) {
    state.cancelled = true;
    // Also kill terminal session if present
    state.terminalSession?.kill().catch(() => {});
    return true;
  }
  return false;
}

export async function pauseRunningAgent(runId: string): Promise<boolean> {
  const state = runningAgents.get(runId);
  if (state?.terminalSession) {
    await state.terminalSession.kill();
    runningAgents.delete(runId);
    await pauseAgentRun(runId);
    await appendTerminalOutput(runId, `\n--- Session paused ---\n`);
    return true;
  }
  // If no in-memory session, just update DB status
  const paused = await pauseAgentRun(runId);
  return paused;
}

export async function verifyWorkspace(workspaceId: string): Promise<boolean> {
  const ws = await getWorkspaceById(workspaceId);
  if (!ws) return false;
  try {
    const { getSandbox } = await import("@/lib/sandbox");
    const sandbox = getSandbox();
    const check = await sandbox.shell.execCommand({
      command: `test -d "${ws.worktreePath}/.git" && echo yes`,
      timeout: 10,
    });
    return check.ok && check.body.data?.output?.trim() === "yes";
  } catch {
    return false;
  }
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
  if (input.mode === "develop" || input.mode === "interactive") {
    if (!input.issueId) throw new Error("issueId is required for develop/interactive mode");
    const issueResult = await getIssueById(input.issueId);
    if (!issueResult.issue) throw new Error("Issue not found");
  } else if (input.mode === "review") {
    if (!input.pullRequestId) throw new Error("pullRequestId is required for review mode");
    const pr = await getPullRequestById(input.pullRequestId);
    if (!pr) throw new Error("Pull request not found");
  }

  if (input.mode !== "interactive" && !hasAIConfig()) {
    throw new Error("AI configuration (AI_API_KEY) is required for agent runs");
  }

  // Create agent run record
  const runId = await createAgentRun({
    issueId: input.issueId,
    pullRequestId: input.pullRequestId,
    mode: input.mode,
    startedBy: input.startedBy,
    workspaceId: input.workspaceId,
  });

  // Track running state
  const agentState: { cancelled: boolean; terminalSession?: TerminalSession } = { cancelled: false };
  runningAgents.set(runId, agentState);

  // Execute agent asynchronously (fire-and-forget)
  if (input.mode === "interactive") {
    void executeInteractiveAgent(
      runId,
      input.issueId!,
      input.options,
      onProgress,
      (session) => { agentState.terminalSession = session; },
    ).finally(() => {
      // Destroy terminal session but preserve workspace worktree
      const state = runningAgents.get(runId);
      state?.terminalSession?.destroy().catch(() => {});
      runningAgents.delete(runId);
    });
  } else if (input.mode === "review") {
    void executeReviewAgent(runId, input.pullRequestId!, onProgress).finally(() => {
      runningAgents.delete(runId);
    });
  } else {
    void executeDevelopAgent(runId, input.issueId!, input.options, onProgress).finally(() => {
      runningAgents.delete(runId);
    });
  }

  return runId;
}

// ─────────────────────────────────────────────────
// Develop Flow (sandbox-enhanced)
// ─────────────────────────────────────────────────
async function executeDevelopAgent(
  runId: string,
  issueId: string,
  options?: { autoCreatePR?: boolean; runTests?: boolean },
  onProgress?: AgentProgressCallback,
): Promise<void> {
  try {
    const issueResult = await getIssueById(issueId);
    const issue = issueResult.issue!;

    await log(runId, "info", "Starting implementation planning...", undefined, onProgress);

    if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

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

    // ── Try sandbox-enhanced planning ──
    let fileTree: string | null = null;
    let relevantFileContents: Array<{ path: string; content: string }> = [];
    let sandboxUsed = false;
    let worktreePath: string | null = null;
    let repoPath: string | null = null;

    const sandboxAvailable = await isSandboxAvailable();
    const token = process.env.GITHUB_TOKEN;

    if (sandboxAvailable && token) {
      try {
        const sandbox = getSandbox();
        await log(runId, "info", "Sandbox available — reading codebase for context...", undefined, onProgress);

        if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

        repoPath = await ensureRepoCloned(sandbox, issue.repoOwner, issue.repoName, token);
        await fetchLatest(sandbox, repoPath);
        await log(runId, "info", "Repository cloned/updated in sandbox", undefined, onProgress);

        if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

        worktreePath = await createWorktree(sandbox, {
          repoPath,
          runId,
          mode: "develop",
          baseBranch: "main",
        });
        await log(runId, "info", "Worktree ready, reading codebase...", undefined, onProgress);

        if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

        // Read file tree
        fileTree = await getFileTree(sandbox, worktreePath);

        // Extract keywords from issue title/body
        const keywords = extractKeywords(issue.title, issue.body);
        const relevantPaths = await findRelevantFiles(sandbox, worktreePath, keywords);
        relevantFileContents = await readFiles(sandbox, relevantPaths);

        await log(
          runId,
          "info",
          `Read ${relevantFileContents.length} relevant file(s), generating code-aware plan...`,
          { files: relevantPaths.map((p) => p.replace(worktreePath + "/", "")) },
          onProgress,
        );

        sandboxUsed = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sandbox error";
        await log(runId, "warn", `Sandbox code reading failed, falling back to blind planning: ${msg}`, undefined, onProgress);
      }
    } else {
      await log(runId, "info", "Sandbox not available — using blind planning mode", undefined, onProgress);
    }

    if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

    // ── Generate plan (with or without code context) ──
    await updateAgentRunStatus(runId, "coding");

    const plan = await generateImplementationPlan({
      issueTitle: issue.title,
      issueBody: issue.body,
      aiSummary: issue.aiSummary,
      aiType: issue.aiType,
      aiPriority: issue.aiPriority,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
      discussionDocument,
      ...(sandboxUsed
        ? {
            fileTree,
            relevantFiles: relevantFileContents,
          }
        : {}),
    });

    await updateAgentRunPlan(runId, plan as unknown as Record<string, unknown>);
    await log(
      runId,
      "info",
      `Plan generated${sandboxUsed ? " (code-aware)" : " (blind)"}: ${plan.summary}`,
      {
        filesCount: plan.files.length,
        testsCount: plan.tests.length,
        complexity: plan.estimatedComplexity,
        sandboxUsed,
      },
      onProgress,
    );

    // Cleanup worktree
    if (worktreePath && repoPath) {
      try {
        const sandbox = getSandbox();
        await cleanupWorktree(sandbox, repoPath, worktreePath);
      } catch { /* best effort */ }
    }

    if (plan.files.length === 0) {
      await log(runId, "warn", "Plan produced no file changes — completing with review status", undefined, onProgress);
      await completeAgentRun(runId, {
        status: "completed",
        artifacts: [{ type: "diff", content: "No changes generated" }],
      });
      return;
    }

    if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

    // ── Code Generation ──
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

    if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

    // ── Testing (placeholder) ──
    if (options?.runTests !== false) {
      await updateAgentRunStatus(runId, "testing");
      await log(runId, "info", "Testing phase — skipped (sandbox code execution not yet implemented)", undefined, onProgress);
    }

    // ── Review ──
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

    // ── Branch + PR (if configured) ──
    let branch: string | undefined;
    let prNumber: number | undefined;

    if (options?.autoCreatePR && process.env.GITHUB_TOKEN) {
      try {
        const branchName = `agent/issue-${issue.repoOwner}-${issue.repoName}-${Date.now()}`;
        await log(runId, "info", `Would create branch: ${branchName}`, undefined, onProgress);
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

// ─────────────────────────────────────────────────
// Review Flow (sandbox-based)
// ─────────────────────────────────────────────────
async function executeReviewAgent(
  runId: string,
  pullRequestId: string,
  onProgress?: AgentProgressCallback,
): Promise<void> {
  try {
    const pr = (await getPullRequestById(pullRequestId))!;

    await log(runId, "info", `Starting code review for PR #${pr.number}...`, undefined, onProgress);

    if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

    const sandboxAvailable = await isSandboxAvailable();
    const token = process.env.GITHUB_TOKEN;

    let diff = "";
    let changedFileContents: Array<{ path: string; content: string }> = [];
    let worktreePath: string | null = null;
    let repoPath: string | null = null;

    if (sandboxAvailable && token) {
      try {
        const sandbox = getSandbox();
        await log(runId, "info", "Sandbox available — checking out PR branch...", undefined, onProgress);

        repoPath = await ensureRepoCloned(sandbox, pr.repoOwner, pr.repoName, token);
        await fetchLatest(sandbox, repoPath);

        if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

        worktreePath = await createWorktree(sandbox, {
          repoPath,
          runId,
          mode: "review",
          baseBranch: pr.baseBranch,
          checkoutBranch: pr.headBranch,
        });
        await log(runId, "info", `Worktree ready for PR #${pr.number}`, undefined, onProgress);

        if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

        // Get diff
        await updateAgentRunStatus(runId, "review");
        diff = await getDiffStats(sandbox, worktreePath, pr.baseBranch);

        // Read changed files from worktree
        const changedFilePaths = extractChangedFiles(diff);
        const fullPaths = changedFilePaths.map((f) => `${worktreePath}/${f}`);
        changedFileContents = await readFiles(sandbox, fullPaths);

        await log(
          runId,
          "info",
          `Read ${changedFileContents.length} changed file(s) for review`,
          undefined,
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sandbox error";
        await log(runId, "warn", `Sandbox review setup failed: ${msg}`, undefined, onProgress);
      }
    } else {
      await updateAgentRunStatus(runId, "review");
      await log(runId, "info", "Sandbox not available — using PR metadata for review", undefined, onProgress);
    }

    if (checkCancelled(runId)) { await handleCancellation(runId, onProgress); return; }

    // Load linked issue context
    let issueContext = "";
    if (pr.linkedIssueNumbers && Array.isArray(pr.linkedIssueNumbers)) {
      for (const num of pr.linkedIssueNumbers as number[]) {
        issueContext += `\nLinked issue #${num}`;
      }
    }

    // Generate review via LLM
    const { getAIClient, MODELS } = await import("@/lib/ai/client");
    const client = getAIClient();

    const reviewParts = [
      `## Pull Request #${pr.number}`,
      `Title: ${pr.title}`,
      `Repository: ${pr.repoOwner}/${pr.repoName}`,
      `Branch: ${pr.headBranch} → ${pr.baseBranch}`,
    ];
    if (pr.body) reviewParts.push(`\nDescription:\n${pr.body}`);
    if (issueContext) reviewParts.push(`\n## Linked Issues${issueContext}`);
    if (diff) reviewParts.push(`\n## Diff\n\`\`\`\n${diff.slice(0, 30000)}\n\`\`\``);
    if (changedFileContents.length > 0) {
      reviewParts.push("\n## Changed Files");
      for (const f of changedFileContents) {
        const relPath = worktreePath ? f.path.replace(worktreePath + "/", "") : f.path;
        reviewParts.push(`\n### ${relPath}\n\`\`\`\n${f.content.slice(0, 10000)}\n\`\`\``);
      }
    }

    const response = await client.chat.completions.create({
      model: MODELS.standard,
      messages: [
        {
          role: "system",
          content: `You are a senior code reviewer. Review the pull request and provide actionable, structured feedback.

You MUST respond with valid JSON matching this schema:
{
  "reviewSummary": "Brief overall summary of the review",
  "overallAssessment": "approve" | "request_changes" | "comment",
  "findings": [
    {
      "file": "relative/path/to/file.ts",
      "lineStart": 10,
      "lineEnd": 15,
      "severity": "info" | "warning" | "error",
      "category": "security" | "performance" | "correctness" | "style" | "testing",
      "message": "Description of the finding"
    }
  ]
}

Focus on: correctness/bugs, security concerns, performance, code style, missing tests.
Only include real findings with accurate file paths and line numbers from the diff.
If no issues found, return an empty findings array with overallAssessment "approve".`,
        },
        { role: "user", content: reviewParts.join("\n") },
      ],
      temperature: 0.3,
    });

    const reviewText = response.choices[0]?.message?.content ?? "";
    await log(runId, "info", "Code review complete", undefined, onProgress);

    // Cleanup worktree
    if (worktreePath && repoPath) {
      try {
        const sandbox = getSandbox();
        await cleanupWorktree(sandbox, repoPath, worktreePath);
      } catch { /* best effort */ }
    }

    // Parse structured review; fall back to plain text
    let artifacts: AgentArtifact[];
    try {
      const jsonText = reviewText.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
      const parsed = JSON.parse(jsonText);
      const findings = (Array.isArray(parsed.findings) ? parsed.findings : []).map(
        (f: Record<string, unknown>, i: number) => ({
          id: crypto.randomUUID(),
          file: String(f.file ?? ""),
          lineStart: Number(f.lineStart ?? 0),
          lineEnd: Number(f.lineEnd ?? f.lineStart ?? 0),
          severity: (["info", "warning", "error"].includes(f.severity as string) ? f.severity : "info") as string,
          category: String(f.category ?? "style"),
          message: String(f.message ?? ""),
        }),
      );
      const errorCount = findings.filter((f: { severity: string }) => f.severity === "error").length;
      const warningCount = findings.filter((f: { severity: string }) => f.severity === "warning").length;
      const infoCount = findings.filter((f: { severity: string }) => f.severity === "info").length;
      artifacts = [{
        type: "structured_review" as const,
        reviewSummary: String(parsed.reviewSummary ?? ""),
        overallAssessment: (["approve", "request_changes", "comment"].includes(parsed.overallAssessment)
          ? parsed.overallAssessment
          : "comment") as "approve" | "request_changes" | "comment",
        findings,
        metadata: {
          filesReviewed: changedFileContents.length,
          totalFindings: findings.length,
          errorCount,
          warningCount,
          infoCount,
        },
      }];
    } catch {
      // JSON parse failed — store old format for backward compat
      artifacts = [{ type: "review", content: reviewText }];
    }

    await completeAgentRun(runId, {
      status: "completed",
      artifacts,
    });

    await log(runId, "info", "Review agent completed successfully", undefined, onProgress);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await log(runId, "error", `Review agent failed: ${message}`, undefined, onProgress);

    try {
      await completeAgentRun(runId, { status: "failed" });
    } catch {
      // Best-effort status update
    }
  }
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

async function handleCancellation(
  runId: string,
  onProgress?: AgentProgressCallback,
): Promise<void> {
  await log(runId, "info", "Agent run cancelled", undefined, onProgress);
  await updateAgentRunStatus(runId, "cancelled");
}

/**
 * Extract keywords from issue title and body for file search.
 */
function extractKeywords(title: string, body: string | null): string[] {
  const text = `${title} ${body ?? ""}`;
  // Extract meaningful words (skip common ones)
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "about",
    "that", "this", "it", "not", "but", "or", "and", "if", "when", "which",
    "what", "how", "add", "fix", "update", "change", "implement", "create",
    "remove", "delete", "new", "old", "bug", "feature", "issue", "error",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Deduplicate and take top keywords
  return [...new Set(words)].slice(0, 8);
}

/**
 * Extract changed file paths from a git diff --stat output.
 */
function extractChangedFiles(diff: string): string[] {
  const lines = diff.split("\n");
  const files: string[] = [];
  for (const line of lines) {
    // git diff --stat lines look like: " path/to/file.ts | 10 +++---"
    const match = line.match(/^\s*(.+?)\s+\|\s+\d+/);
    if (match) {
      files.push(match[1].trim());
    }
  }
  return files;
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
