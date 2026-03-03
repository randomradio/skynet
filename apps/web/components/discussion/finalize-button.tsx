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
      <span className="rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
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
        <span className="text-xs text-slate-600">Finalize? This cannot be undone.</span>
        <button
          onClick={handleFinalize}
          disabled={loading}
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Finalizing..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
    >
      Finalize
    </button>
  );
}
