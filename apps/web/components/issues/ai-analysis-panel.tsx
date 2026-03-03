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
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">AI Analysis</h3>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : hasAnalysis ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600">{error}</p>
      )}

      {!hasAnalysis && !loading && (
        <p className="text-sm text-slate-500">
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
              <p className="text-xs font-medium text-slate-500">Summary</p>
              <p className="text-sm text-slate-700">{aiSummary}</p>
            </div>
          )}

          {aiTags && aiTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">Tags</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {aiTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiAnalysis && (
            <div className="space-y-2">
              {aiAnalysis.rootCause && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Root Cause</p>
                  <p className="text-sm text-slate-700">{aiAnalysis.rootCause}</p>
                </div>
              )}
              {aiAnalysis.suggestedApproach && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Suggested Approach</p>
                  <p className="text-sm text-slate-700">{aiAnalysis.suggestedApproach}</p>
                </div>
              )}
              {aiAnalysis.affectedAreas && aiAnalysis.affectedAreas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Affected Areas</p>
                  <p className="text-sm text-slate-700">{aiAnalysis.affectedAreas.join(", ")}</p>
                </div>
              )}
              {aiAnalysis.estimatedComplexity && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Complexity</p>
                  <p className="text-sm text-slate-700">{aiAnalysis.estimatedComplexity}</p>
                </div>
              )}
            </div>
          )}

          {lastAnalyzedAt && (
            <p className="text-xs text-slate-400">
              Last analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
