"use client";

import { useState } from "react";

interface FinalizeButtonProps {
  issueId: string;
  finalized: boolean;
  onFinalized: (document: string) => void;
}

export function FinalizeButton({ issueId, finalized, onFinalized }: FinalizeButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (finalized) {
    return (
      <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
        Finalized
      </span>
    );
  }

  async function handleFinalize() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/discussion/finalize`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.finalized) {
        onFinalized(data.document);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-quaternary)]">Finalize? This cannot be undone.</span>
        <button
          onClick={handleFinalize}
          disabled={loading}
          className="rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 transition-all hover:bg-red-500/20 disabled:opacity-50"
        >
          {loading ? "Finalizing..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
    >
      Finalize
    </button>
  );
}
