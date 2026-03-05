import { NextRequest, NextResponse } from "next/server";
import { getAgentRunById, type AgentArtifact } from "@skynet/db";
import type { ReviewFinding } from "@/lib/types/code-review";
import { applyFixesToWorktree } from "@/lib/agent/generate-fixes";
import {
  getSandbox,
  isSandboxAvailable,
  ensureRepoCloned,
  fetchLatest,
  createWorktree,
} from "@/lib/sandbox";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; number: string }> },
) {
  const { owner, name, number: prNum } = await params;
  const body = await req.json();
  const { agentRunId, findingIds } = body;

  if (!agentRunId) {
    return NextResponse.json({ error: "agentRunId required" }, { status: 400 });
  }

  const run = await getAgentRunById(agentRunId);
  if (!run) {
    return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
  }

  // Extract findings from artifacts
  const artifacts = Array.isArray(run.artifacts) ? (run.artifacts as AgentArtifact[]) : [];
  const structured = artifacts.find((a) => a.type === "structured_review");
  if (!structured || !structured.findings) {
    return NextResponse.json({ error: "No structured review findings" }, { status: 400 });
  }

  let findings = structured.findings as ReviewFinding[];
  if (findingIds && Array.isArray(findingIds)) {
    findings = findings.filter((f) => findingIds.includes(f.id));
  }

  const sandboxAvailable = await isSandboxAvailable();
  const token = process.env.GITHUB_TOKEN;

  if (!sandboxAvailable || !token) {
    return NextResponse.json({ error: "Sandbox not available" }, { status: 503 });
  }

  try {
    const sandbox = getSandbox();
    const repoPath = await ensureRepoCloned(sandbox, owner, name, token);
    await fetchLatest(sandbox, repoPath);

    const worktreePath = await createWorktree(sandbox, {
      repoPath,
      runId: `fix-${agentRunId.slice(0, 8)}-${Date.now()}`,
      mode: "review",
      baseBranch: "main",
    });

    const result = await applyFixesToWorktree(agentRunId, findings, worktreePath, "main");

    return NextResponse.json({
      diff: result.diff,
      appliedFixes: result.appliedFixes,
      worktreePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fix generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
