"use client";

import { useState } from "react";
import { RichText } from "@/components/rich-text/rich-text";

interface LivingDocumentPanelProps {
  issueId: string;
  document: string | null;
  lastSynthesizedAt: string | null;
  finalized: boolean;
  repoContext?: { owner: string; name: string };
}

export function LivingDocumentPanel({
  issueId,
  document,
  lastSynthesizedAt,
  finalized,
  repoContext,
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
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Living Document
          </h3>
          {finalized && (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Finalized
            </span>
          )}
        </div>
        {!finalized && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-md border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-tertiary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {doc ? (
          <RichText content={doc} format="markdown" repoContext={repoContext} />
        ) : (
          <p className="text-xs text-[var(--text-quaternary)]">
            No document yet. The living document will be generated after a few messages.
          </p>
        )}
      </div>

      {lastSynthesizedAt && (
        <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-quaternary)]">
          Last updated: {new Date(lastSynthesizedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
