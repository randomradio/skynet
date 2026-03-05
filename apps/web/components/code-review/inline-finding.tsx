"use client";

import type { ReviewFinding, ReviewFeedback } from "@/lib/types/code-review";

interface InlineFindingProps {
  finding: ReviewFinding;
  feedback?: ReviewFeedback;
  onFeedback?: (findingId: string, action: "approve" | "reject" | "comment", comment?: string) => void;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  error: { bg: "bg-red-500/10", text: "text-red-400", border: "border-l-red-500" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-l-amber-500" },
  info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-l-blue-500" },
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "bg-red-500/15 text-red-300",
  performance: "bg-amber-500/15 text-amber-300",
  correctness: "bg-orange-500/15 text-orange-300",
  style: "bg-blue-500/15 text-blue-300",
  testing: "bg-purple-500/15 text-purple-300",
};

export function InlineFinding({ finding, feedback, onFeedback }: InlineFindingProps) {
  const colors = SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info;
  const catColor = CATEGORY_COLORS[finding.category] ?? "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]";

  return (
    <div className={`border-l-2 ${colors.border} ${colors.bg} px-3 py-2 my-0.5`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase ${colors.text}`}>
          {finding.severity}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${catColor}`}>
          {finding.category}
        </span>
        <span className="text-xs text-[var(--text-secondary)] flex-1">{finding.message}</span>
        {feedback && (
          <span className={`text-[10px] font-medium ${
            feedback.action === "approve" ? "text-emerald-400" :
            feedback.action === "reject" ? "text-red-400" : "text-[var(--text-quaternary)]"
          }`}>
            {feedback.action}
          </span>
        )}
      </div>

      {/* Suggested fix preview */}
      {finding.suggestedFix && (
        <div className="mt-1.5 rounded bg-[var(--bg-primary)] p-2 font-mono text-xs">
          <div className="text-[var(--text-quaternary)] mb-1">Suggested fix:</div>
          <div className="text-red-400/80 line-through">{finding.suggestedFix.originalCode}</div>
          <div className="text-emerald-400/80">{finding.suggestedFix.proposedCode}</div>
        </div>
      )}

      {/* Feedback buttons */}
      {onFeedback && (
        <div className="mt-1.5 flex items-center gap-1">
          <button
            onClick={() => onFeedback(finding.id, "approve")}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              feedback?.action === "approve"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-[var(--text-quaternary)] hover:bg-emerald-500/10 hover:text-emerald-400"
            }`}
          >
            Approve
          </button>
          <button
            onClick={() => onFeedback(finding.id, "reject")}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              feedback?.action === "reject"
                ? "bg-red-500/20 text-red-400"
                : "text-[var(--text-quaternary)] hover:bg-red-500/10 hover:text-red-400"
            }`}
          >
            Reject
          </button>
          <button
            onClick={() => {
              const c = prompt("Comment:");
              if (c) onFeedback(finding.id, "comment", c);
            }}
            className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-quaternary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Comment
          </button>
        </div>
      )}
    </div>
  );
}
