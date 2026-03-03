"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";

interface AgentRunItem {
  id: string;
  issueId: string;
  startedBy: string;
  status: string;
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
        setData(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Agent Runs</h1>
      </div>

      <div className="flex gap-2">
        {["", "planning", "coding", "testing", "review", "completed", "failed", "cancelled"].map(
          (s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded px-3 py-1 text-xs font-medium ${
                statusFilter === s
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s || "All"}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">
          No agent runs found. Start one from an issue detail page.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Branch</th>
                  <th className="px-4 py-2">Started</th>
                  <th className="px-4 py-2">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/agents/${run.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {run.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <AgentStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {run.plan?.summary
                        ? run.plan.summary.length > 60
                          ? run.plan.summary.slice(0, 60) + "..."
                          : run.plan.summary
                        : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {run.branch ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {run.completedAt
                        ? new Date(run.completedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {data.total} total run{data.total !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded bg-slate-100 px-3 py-1 text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 text-xs">Page {page}</span>
              <button
                disabled={page * data.limit >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded bg-slate-100 px-3 py-1 text-xs disabled:opacity-50"
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
