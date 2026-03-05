import { getPullRequestByNumber, getAgentRunByPRId, type AgentArtifact } from "@skynet/db";
import type { ReviewFinding, StructuredReviewArtifact } from "@/lib/types/code-review";

export interface ReviewResult {
  agentRunId: string;
  status: string;
  reviewSummary: string | null;
  overallAssessment: "approve" | "request_changes" | "comment" | null;
  findings: ReviewFinding[];
  metadata: {
    filesReviewed: number;
    totalFindings: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  } | null;
  completedAt: string | null;
}

export async function getAgentRunsByPullRequest(
  owner: string,
  name: string,
  prNumber: number,
): Promise<ReviewResult | null> {
  const pr = await getPullRequestByNumber(owner, name, prNumber);
  if (!pr) return null;

  const run = await getAgentRunByPRId(pr.id);
  if (!run) return null;

  const arr = Array.isArray(run.artifacts) ? (run.artifacts as AgentArtifact[]) : [];

  // Try structured review first
  const structured = arr.find((a) => a.type === "structured_review") as
    | (AgentArtifact & StructuredReviewArtifact)
    | undefined;

  if (structured) {
    return {
      agentRunId: run.id,
      status: run.status,
      reviewSummary: structured.reviewSummary ?? null,
      overallAssessment: structured.overallAssessment ?? null,
      findings: (structured.findings as ReviewFinding[]) ?? [],
      metadata: (structured.metadata as ReviewResult["metadata"]) ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }

  // Fall back to legacy plain-text review
  const legacy = arr.find((a) => a.type === "review");
  return {
    agentRunId: run.id,
    status: run.status,
    reviewSummary: legacy?.content ?? null,
    overallAssessment: null,
    findings: [],
    metadata: null,
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}
