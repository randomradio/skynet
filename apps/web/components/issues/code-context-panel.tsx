"use client";

import { useEffect, useState, useCallback } from "react";
import type { CodeContextSnippet } from "@/lib/types/code-review";

interface CodeContextPanelProps {
  issueId: string;
}

export function CodeContextPanel({ issueId }: CodeContextPanelProps) {
  const [snippets, setSnippets] = useState<CodeContextSnippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Load cached snippets on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/issues/${issueId}/code-context`);
        if (res.ok) {
          const data = await res.json();
          if (data.snippets?.length > 0) {
            setSnippets(data.snippets);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [issueId]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/code-context`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSnippets(data.snippets ?? []);
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  }, [issueId]);

  const toggleExpand = useCallback((index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
          Related Code
        </h3>
        {snippets.length === 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {generating ? "Analyzing..." : "Load Related Code"}
          </button>
        )}
      </div>

      {snippets.length === 0 && !generating && (
        <p className="text-xs text-[var(--text-quaternary)]">
          AI can analyze the repository to find code relevant to this issue.
        </p>
      )}

      {generating && snippets.length === 0 && (
        <div className="text-xs text-[var(--text-quaternary)] animate-pulse">
          Analyzing repository for relevant code...
        </div>
      )}

      {snippets.length > 0 && (
        <div className="space-y-2">
          {snippets.map((snippet, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden"
            >
              {/* Header - always visible */}
              <button
                onClick={() => toggleExpand(i)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className="text-[10px] text-[var(--text-quaternary)]">
                  {expandedIds.has(i) ? "v" : ">"}
                </span>
                <span className="font-mono text-xs font-medium text-[var(--text-primary)] truncate">
                  {snippet.file}
                </span>
                <span className="ml-auto text-[10px] text-[var(--text-quaternary)]">
                  L{snippet.lineStart}-{snippet.lineEnd}
                </span>
              </button>

              {/* Expanded content */}
              {expandedIds.has(i) && (
                <div className="border-t border-[var(--border-subtle)]">
                  <pre className="overflow-x-auto p-3 font-mono text-xs text-[var(--text-secondary)] leading-5">
                    {snippet.content}
                  </pre>
                  <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {snippet.relevanceReason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Refresh button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-2 text-xs text-[var(--accent-blue)] hover:underline disabled:opacity-50"
          >
            {generating ? "Refreshing..." : "Refresh snippets"}
          </button>
        </div>
      )}
    </div>
  );
}
