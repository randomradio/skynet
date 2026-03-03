"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";
import { AgentLogViewer } from "@/components/agents/agent-log-viewer";
import { AgentPlanViewer } from "@/components/agents/agent-plan-viewer";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}

interface AgentRun {
  id: string;
  issueId: string;
  startedBy: string;
  status: string;
  plan: Record<string, unknown> | null;
  branch: string | null;
  prNumber: number | null;
  logs: LogEntry[];
  artifacts: Array<{ type: string; path?: string; content?: string }>;
  startedAt: string;
  completedAt: string | null;
}

const TERMINAL = ["completed", "failed", "cancelled"];

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Initial load
  useEffect(() => {
    fetch(`/api/agents/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error.message);
        } else {
          setRun(data.run);
          setLogs(Array.isArray(data.run.logs) ? data.run.logs : []);
        }
      })
      .catch(() => setError("Failed to load agent run"))
      .finally(() => setLoading(false));
  }, [params.id]);

  // SSE streaming for live logs
  useEffect(() => {
    if (!run || TERMINAL.includes(run.status)) return;

    const eventSource = new EventSource(`/api/agents/${params.id}/logs`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.log) {
          setLogs((prev) => {
            // Deduplicate by timestamp+message
            const exists = prev.some(
              (l) => l.timestamp === data.log.timestamp && l.message === data.log.message,
            );
            if (exists) return prev;
            return [...prev, data.log];
          });
        }

        if (data.status && data.status !== run.status) {
          setRun((prev) => prev ? { ...prev, status: data.status } : prev);
        }

        if (data.done) {
          if (data.plan) {
            setRun((prev) => prev ? { ...prev, plan: data.plan } : prev);
          }
          if (data.branch) {
            setRun((prev) => prev ? { ...prev, branch: data.branch } : prev);
          }
          if (data.status) {
            setRun((prev) =>
              prev ? { ...prev, status: data.status, completedAt: new Date().toISOString() } : prev,
            );
          }
          eventSource.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect only on status change, not full run object
  }, [run?.status, params.id]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/agents/${params.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!data.error) {
        setRun((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      }
    } catch {
      // Ignore
    } finally {
      setCancelling(false);
    }
  }, [params.id]);

  if (loading) {
    return <div className="text-sm text-slate-500">Loading...</div>;
  }

  if (error || !run) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error ?? "Agent run not found"}</p>
        <Link href="/agents" className="text-sm text-blue-600 hover:underline">
          Back to agent runs
        </Link>
      </div>
    );
  }

  const isActive = !TERMINAL.includes(run.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/agents" className="text-sm text-blue-600 hover:underline">
          &larr; Back to agent runs
        </Link>
        {isActive && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500 disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel Run"}
          </button>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-lg font-semibold text-slate-900">
            {run.id.slice(0, 8)}...
          </h1>
          <AgentStatusBadge status={run.status} />
        </div>

        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-slate-400">Issue: </span>
            <Link href={`/issues/${run.issueId}`} className="text-blue-600 hover:underline">
              {run.issueId.slice(0, 8)}...
            </Link>
          </div>
          <div>
            <span className="text-slate-400">Started: </span>
            {new Date(run.startedAt).toLocaleString()}
          </div>
          {run.completedAt && (
            <div>
              <span className="text-slate-400">Completed: </span>
              {new Date(run.completedAt).toLocaleString()}
            </div>
          )}
          {run.branch && (
            <div>
              <span className="text-slate-400">Branch: </span>
              <span className="font-mono text-xs">{run.branch}</span>
            </div>
          )}
          {run.prNumber && (
            <div>
              <span className="text-slate-400">PR: </span>
              <span className="font-mono text-xs">#{run.prNumber}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Implementation Plan</h2>
          <AgentPlanViewer plan={run.plan as Parameters<typeof AgentPlanViewer>[0]["plan"]} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Logs ({logs.length})
            {isActive && (
              <span className="ml-2 text-xs font-normal text-slate-400">Live</span>
            )}
          </h2>
          <AgentLogViewer logs={logs} />
        </div>
      </div>

      {run.artifacts && Array.isArray(run.artifacts) && run.artifacts.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Artifacts ({run.artifacts.length})
          </h2>
          <div className="space-y-2">
            {run.artifacts.map((artifact, i) => (
              <div key={i} className="rounded-lg border bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{artifact.type}</span>
                  {artifact.path && (
                    <span className="font-mono">{artifact.path}</span>
                  )}
                </div>
                {artifact.content && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-950 p-3 font-mono text-xs text-slate-300">
                    {artifact.content}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
