"use client";

import { useEffect, useState, useCallback } from "react";
import type { ReviewFinding, ReviewFeedback } from "@/lib/types/code-review";

interface ReviewData {
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

interface ReviewPanelProps {
  owner: string;
  name: string;
  prNumber: number;
  onFindingClick?: (file: string, line: number) => void;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  error: { bg: "bg-red-500/10", text: "text-red-600", label: "Error" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-600", label: "Warning" },
  info: { bg: "bg-[var(--accent-blue)]/10", text: "text-[var(--accent-blue)]", label: "Info" },
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "bg-red-500/15 text-red-500",
  performance: "bg-amber-500/15 text-amber-500",
  correctness: "bg-orange-500/15 text-orange-600",
  style: "bg-blue-500/15 text-blue-600",
  testing: "bg-purple-500/15 text-purple-600",
};

const ASSESSMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approve: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Approved" },
  request_changes: { bg: "bg-red-500/10", text: "text-red-600", label: "Changes Requested" },
  comment: { bg: "bg-amber-500/10", text: "text-amber-600", label: "Commented" },
};

export function ReviewPanel({ owner, name, prNumber, onFindingClick }: ReviewPanelProps) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, ReviewFeedback>>({});
  const [generatingFixes, setGeneratingFixes] = useState(false);
  const [sandboxDiff, setSandboxDiff] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/repos/${owner}/${name}/pulls/${prNumber}/review`,
        );
        if (!res.ok) {
          setError("Failed to load review");
          return;
        }
        const data = await res.json();
        setReview(data.review ?? null);
      } catch {
        setError("Failed to load review");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [owner, name, prNumber]);

  // Load feedback
  useEffect(() => {
    if (!review?.agentRunId) return;
    async function loadFeedback() {
      try {
        const res = await fetch(
          `/api/repos/${owner}/${name}/pulls/${prNumber}/review/feedback?agentRunId=${review!.agentRunId}`,
        );
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, ReviewFeedback> = {};
          for (const fb of data.feedback ?? []) {
            map[fb.findingId] = fb;
          }
          setFeedback(map);
        }
      } catch {
        // ignore
      }
    }
    loadFeedback();
  }, [review?.agentRunId, owner, name, prNumber]);

  const handleFeedback = useCallback(
    async (findingId: string, action: "approve" | "reject" | "comment", comment?: string) => {
      if (!review) return;
      try {
        const res = await fetch(
          `/api/repos/${owner}/${name}/pulls/${prNumber}/review/feedback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentRunId: review.agentRunId,
              findingId,
              action,
              comment,
            }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          setFeedback((prev) => ({ ...prev, [findingId]: data.feedback }));
        }
      } catch {
        // ignore
      }
    },
    [review, owner, name, prNumber],
  );

  const handleGenerateFixes = useCallback(async () => {
    if (!review) return;
    setGeneratingFixes(true);
    try {
      const res = await fetch(
        `/api/repos/${owner}/${name}/pulls/${prNumber}/review/apply-fixes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentRunId: review.agentRunId }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setSandboxDiff(data.diff ?? null);
      }
    } catch {
      // ignore
    } finally {
      setGeneratingFixes(false);
    }
  }, [review, owner, name, prNumber]);

  const handleCommit = useCallback(async () => {
    const msg = prompt("Commit message:", "fix: apply AI review suggestions");
    if (!msg) return;
    try {
      const res = await fetch(
        `/api/repos/${owner}/${name}/pulls/${prNumber}/review/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
        },
      );
      if (res.ok) {
        setSandboxDiff(null);
        alert("Changes committed and pushed.");
      }
    } catch {
      // ignore
    }
  }, [owner, name, prNumber]);

  const handleDiscard = useCallback(async () => {
    if (!confirm("Discard all sandbox changes?")) return;
    try {
      await fetch(
        `/api/repos/${owner}/${name}/pulls/${prNumber}/review/discard`,
        { method: "POST" },
      );
      setSandboxDiff(null);
    } catch {
      // ignore
    }
  }, [owner, name, prNumber]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-quaternary)]">
        Loading AI review...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-sm text-red-600">{error}</div>
    );
  }

  if (!review) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">
          No AI review available yet.
        </p>
        <p className="mt-1 text-xs text-[var(--text-quaternary)]">
          Click &ldquo;Start AI Review&rdquo; on the Overview tab to generate one.
        </p>
      </div>
    );
  }

  const statusLabel =
    review.status === "completed"
      ? "Completed"
      : review.status === "failed"
        ? "Failed"
        : "In Progress";

  const statusColor =
    review.status === "completed"
      ? "text-emerald-600"
      : review.status === "failed"
        ? "text-red-600"
        : "text-amber-600";

  // Group findings by file
  const findingsByFile: Record<string, ReviewFinding[]> = {};
  for (const f of review.findings) {
    if (!findingsByFile[f.file]) findingsByFile[f.file] = [];
    findingsByFile[f.file].push(f);
  }

  const approvedCount = Object.values(feedback).filter((f) => f.action === "approve").length;
  const rejectedCount = Object.values(feedback).filter((f) => f.action === "reject").length;
  const pendingCount = review.findings.length - approvedCount - rejectedCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Review</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {review.completedAt && (
              <p className="text-xs text-[var(--text-quaternary)]">
                {new Date(review.completedAt).toLocaleString()}
              </p>
            )}
            {review.overallAssessment && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ASSESSMENT_STYLES[review.overallAssessment]?.bg ?? ""} ${ASSESSMENT_STYLES[review.overallAssessment]?.text ?? ""}`}>
                {ASSESSMENT_STYLES[review.overallAssessment]?.label ?? review.overallAssessment}
              </span>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Metadata counts */}
      {review.metadata && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-tertiary)]">
            {review.metadata.totalFindings} findings
          </span>
          {review.metadata.errorCount > 0 && (
            <span className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-600">
              {review.metadata.errorCount} errors
            </span>
          )}
          {review.metadata.warningCount > 0 && (
            <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600">
              {review.metadata.warningCount} warnings
            </span>
          )}
          {review.metadata.infoCount > 0 && (
            <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-600">
              {review.metadata.infoCount} info
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {review.reviewSummary && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Summary
          </h4>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
            {review.reviewSummary}
          </p>
        </div>
      )}

      {/* Feedback summary */}
      {review.findings.length > 0 && Object.keys(feedback).length > 0 && (
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-600">{approvedCount} approved</span>
          <span className="text-red-600">{rejectedCount} rejected</span>
          <span className="text-[var(--text-quaternary)]">{pendingCount} pending</span>
        </div>
      )}

      {/* Findings grouped by file */}
      {review.findings.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
            Findings ({review.findings.length})
          </h4>
          {Object.entries(findingsByFile).map(([file, findings]) => (
            <div key={file} className="space-y-2">
              <p className="font-mono text-xs font-medium text-[var(--text-tertiary)]">{file}</p>
              {findings.map((finding) => {
                const style = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.info!;
                const catColor = CATEGORY_COLORS[finding.category] ?? "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]";
                const fb = feedback[finding.id];
                return (
                  <div
                    key={finding.id}
                    className={`rounded-lg border border-[var(--border-default)] ${style.bg} p-3`}
                  >
                    <div className="mb-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold uppercase ${style.text}`}>
                        {style.label}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${catColor}`}>
                        {finding.category}
                      </span>
                      <button
                        onClick={() => onFindingClick?.(finding.file, finding.lineStart)}
                        className="font-mono text-xs text-[var(--accent-blue)] hover:underline cursor-pointer"
                      >
                        {finding.file}:{finding.lineStart}
                      </button>
                      {fb && (
                        <span className={`ml-auto text-[10px] font-medium ${
                          fb.action === "approve" ? "text-emerald-600" :
                          fb.action === "reject" ? "text-red-600" : "text-[var(--text-quaternary)]"
                        }`}>
                          {fb.action === "approve" ? "Approved" : fb.action === "reject" ? "Rejected" : "Commented"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{finding.message}</p>
                    {/* Feedback actions */}
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={() => handleFeedback(finding.id, "approve")}
                        className={`rounded px-2 py-0.5 text-xs transition-colors ${
                          fb?.action === "approve"
                            ? "bg-emerald-500/20 text-emerald-600"
                            : "text-[var(--text-quaternary)] hover:bg-emerald-500/10 hover:text-emerald-600"
                        }`}
                        title="Approve"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleFeedback(finding.id, "reject")}
                        className={`rounded px-2 py-0.5 text-xs transition-colors ${
                          fb?.action === "reject"
                            ? "bg-red-500/20 text-red-600"
                            : "text-[var(--text-quaternary)] hover:bg-red-500/10 hover:text-red-600"
                        }`}
                        title="Reject"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          const c = prompt("Comment on this finding:");
                          if (c) handleFeedback(finding.id, "comment", c);
                        }}
                        className="rounded px-2 py-0.5 text-xs text-[var(--text-quaternary)] hover:bg-[var(--bg-elevated)] transition-colors"
                        title="Comment"
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        review.status === "completed" && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-sm text-emerald-600">No issues found</p>
          </div>
        )
      )}

      {/* Generate fixes / sandbox diff actions */}
      {review.findings.length > 0 && review.status === "completed" && (
        <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          {!sandboxDiff ? (
            <button
              onClick={handleGenerateFixes}
              disabled={generatingFixes}
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-[var(--accent-purple)] to-purple-600 px-4 py-2 text-xs font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--glow-purple)] disabled:opacity-50"
            >
              {generatingFixes ? "Generating Fixes..." : "Generate Fixes"}
            </button>
          ) : (
            <>
              <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
                Sandbox Changes (git diff)
              </h4>
              <pre className="max-h-96 overflow-auto rounded-lg bg-[var(--bg-primary)] p-3 font-mono text-xs text-[var(--text-secondary)]">
                {sandboxDiff}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={handleCommit}
                  disabled={approvedCount === 0}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
                >
                  Commit & Push
                </button>
                <button
                  onClick={handleDiscard}
                  className="inline-flex items-center rounded-lg bg-red-600/20 border border-red-500/30 px-4 py-2 text-xs font-medium text-red-600 transition-all hover:bg-red-600/30"
                >
                  Discard All Changes
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
