"use client";

import { useState } from "react";

interface LivingDocumentPanelProps {
  issueId: string;
  document: string | null;
  lastSynthesizedAt: string | null;
  finalized: boolean;
}

export function LivingDocumentPanel({
  issueId,
  document,
  lastSynthesizedAt,
  finalized,
}: LivingDocumentPanelProps) {
  const [doc, setDoc] = useState(document);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/discussion/synthesize`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.document) {
        setDoc(data.document);
      }
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Living Document</h3>
          {finalized && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Finalized
            </span>
          )}
        </div>
        {!finalized && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {doc ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-slate-700">
            {doc}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No document yet. The living document will be generated after a few messages.
          </p>
        )}
      </div>

      {lastSynthesizedAt && (
        <div className="border-t px-4 py-2 text-xs text-slate-400">
          Last updated: {new Date(lastSynthesizedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
