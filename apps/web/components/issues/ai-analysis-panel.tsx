"use client";

import { useState } from "react";
import { PriorityBadge } from "./priority-badge";
import { TypeBadge } from "./type-badge";

interface AIAnalysis {
  rootCause?: string;
  suggestedApproach?: string;
  affectedAreas?: string[];
  estimatedComplexity?: string;
}

interface AIAnalysisPanelProps {
  issueId: string;
  aiType: string | null;
  aiPriority: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  aiAnalysis: AIAnalysis | null;
  lastAnalyzedAt: string | null;
}

export function AIAnalysisPanel({
  issueId,
  aiType,
  aiPriority,
  aiSummary,
  aiTags,
  aiAnalysis,
  lastAnalyzedAt,
}: AIAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Analysis failed");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const hasAnalysis = aiType || aiPriority || aiSummary;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          AI Analysis
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="rounded-md bg-[var(--accent-blue)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-blue)] transition-all hover:bg-[var(--accent-blue)]/20 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : hasAnalysis ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600">{error}</p>
      )}

      {!hasAnalysis && !loading && (
        <p className="text-xs text-[var(--text-quaternary)]">
          No analysis yet. Click &ldquo;Analyze&rdquo; to classify this issue with AI.
        </p>
      )}

      {hasAnalysis && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <TypeBadge type={aiType} />
            <PriorityBadge priority={aiPriority} />
          </div>

          {aiSummary && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Summary</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{aiSummary}</p>
            </div>
          )}

          {aiTags && aiTags.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Tags</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {aiTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-2.5">
              {aiAnalysis.rootCause && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Root Cause</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{aiAnalysis.rootCause}</p>
                </div>
              )}
              {aiAnalysis.suggestedApproach && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Suggested Approach</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{aiAnalysis.suggestedApproach}</p>
                </div>
              )}
              {aiAnalysis.affectedAreas && aiAnalysis.affectedAreas.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Affected Areas</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{aiAnalysis.affectedAreas.join(", ")}</p>
                </div>
              )}
              {aiAnalysis.estimatedComplexity && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Complexity</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{aiAnalysis.estimatedComplexity}</p>
                </div>
              )}
            </div>
          )}

          {lastAnalyzedAt && (
            <p className="text-xs text-[var(--text-quaternary)]">
              Last analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
