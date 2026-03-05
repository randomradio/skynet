"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";

interface AgentRunItem {
  id: string;
  issueId: string | null;
  startedBy: string;
  status: string;
  mode: "develop" | "review" | "interactive";
  pullRequestId: string | null;
  plan: { summary?: string } | null;
  branch: string | null;
  prNumber: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface AgentListResponse {
  items: AgentRunItem[];
  page: number;
  limit: number;
  total: number;
}

export default function AgentsPage() {
  const [data, setData] = useState<AgentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/agents?${params}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.error || !Array.isArray(result.items)) {
          setData({ items: [], page: 1, limit: 20, total: 0 });
        } else {
          setData(result);
        }
        setLoading(false);
      })
      .catch(() => {
        setData({ items: [], page: 1, limit: 20, total: 0 });
        setLoading(false);
      });
  }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Agent Runs</h1>

      <div className="flex flex-wrap gap-1.5">
        {["", "planning", "coding", "testing", "review", "paused", "completed", "failed", "cancelled"].map(
          (s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] ring-1 ring-inset ring-[var(--accent-blue)]/20"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {s || "All"}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-quaternary)]">Loading...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-quaternary)]">
          No agent runs found. Start one from an issue detail page.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
                <tr>
                  <th className="px-4 py-3.5">ID</th>
                  <th className="px-4 py-3.5">Mode</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Plan</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5">Started</th>
                  <th className="px-4 py-3.5">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.items.map((run) => (
                  <tr key={run.id} className="transition-colors hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/agents/${run.id}`}
                        className="font-mono text-xs text-[var(--accent-blue)] hover:underline"
                      >
                        {run.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.mode === "review"
                          ? "bg-amber-500/10 text-amber-600"
                          : run.mode === "interactive"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-[var(--accent-purple)]/10 text-[var(--accent-purple)]"
                      }`}>
                        {run.mode === "review" ? "Review" : run.mode === "interactive" ? "Interactive" : "Develop"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <AgentStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-tertiary)]">
                      {run.plan?.summary
                        ? run.plan.summary.length > 60
                          ? run.plan.summary.slice(0, 60) + "..."
                          : run.plan.summary
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--text-quaternary)]">
                      {run.branch ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-quaternary)]">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-quaternary)]">
                      {run.completedAt
                        ? new Date(run.completedAt).toLocaleString()
                        : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-quaternary)]">
            <span>
              {data.total} total run{data.total !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs transition-all hover:bg-[var(--bg-hover)] disabled:opacity-30"
              >
                Previous
              </button>
              <span className="flex items-center px-2 text-xs">Page {page}</span>
              <button
                disabled={page * data.limit >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs transition-all hover:bg-[var(--bg-hover)] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
