"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";
import { AgentLogViewer } from "@/components/agents/agent-log-viewer";
import { AgentPlanViewer } from "@/components/agents/agent-plan-viewer";
import { InteractiveTerminal } from "@/components/agents/interactive-terminal";
import { TerminalInputBar } from "@/components/agents/terminal-input-bar";
import { useTerminalStream } from "@/hooks/use-terminal-stream";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}

interface AgentRun {
  id: string;
  issueId: string | null;
  startedBy: string;
  status: string;
  mode: "develop" | "review" | "interactive";
  pullRequestId: string | null;
  plan: Record<string, unknown> | null;
  branch: string | null;
  prNumber: number | null;
  logs: LogEntry[];
  artifacts: Array<{ type: string; path?: string; content?: string }>;
  startedAt: string;
  completedAt: string | null;
}

const TERMINAL = ["completed", "failed", "cancelled"];
const PAUSABLE = ["planning", "coding", "testing", "waiting_for_input"];

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);

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

  const handlePause = useCallback(async () => {
    setPausing(true);
    try {
      const res = await fetch(`/api/agents/${params.id}/pause`, { method: "POST" });
      const data = await res.json();
      if (!data.error) {
        setRun((prev) => prev ? { ...prev, status: "paused" } : prev);
      }
    } catch {
      // Ignore
    } finally {
      setPausing(false);
    }
  }, [params.id]);

  const handleResume = useCallback(async () => {
    if (!run?.issueId) return;
    setResuming(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: run.issueId, mode: "interactive" }),
      });
      const data = await res.json();
      if (data.id) {
        // Navigate to the new run
        window.location.href = `/agents/${data.id}`;
      }
    } catch {
      // Ignore
    } finally {
      setResuming(false);
    }
  }, [run?.issueId]);

  const handleHandoff = useCallback(async (assignTo: string) => {
    try {
      const res = await fetch(`/api/agents/${params.id}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignTo }),
      });
      const data = await res.json();
      if (!data.error) {
        setShowHandoff(false);
      }
    } catch {
      // Ignore
    }
  }, [params.id]);

  if (loading) {
    return <div className="text-sm text-[var(--text-quaternary)]">Loading...</div>;
  }

  if (error || !run) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-400">{error ?? "Agent run not found"}</p>
        <Link href="/agents" className="text-sm text-[var(--accent-blue)] hover:underline">
          Back to agent runs
        </Link>
      </div>
    );
  }

  const isActive = !TERMINAL.includes(run.status);
  const isInteractive = run.mode === "interactive";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/agents" className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-blue)]">
          &larr; Back to agent runs
        </Link>
        <div className="flex gap-2">
          {isActive && PAUSABLE.includes(run.status) && (
            <button
              onClick={handlePause}
              disabled={pausing}
              className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-1.5 text-xs font-medium text-yellow-400 transition-all hover:bg-yellow-500/20 disabled:opacity-40"
            >
              {pausing ? "Pausing..." : "Pause"}
            </button>
          )}
          {run.status === "paused" && (
            <>
              <button
                onClick={handleResume}
                disabled={resuming}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-40"
              >
                {resuming ? "Resuming..." : "Resume"}
              </button>
              <button
                onClick={() => setShowHandoff(true)}
                className="rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-4 py-1.5 text-xs font-medium text-[var(--accent-blue)] transition-all hover:bg-[var(--accent-blue)]/20"
              >
                Handoff
              </button>
            </>
          )}
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-40"
            >
              {cancelling ? "Cancelling..." : "Cancel Run"}
            </button>
          )}
        </div>
      </div>

      <div className="card-glow rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-lg font-semibold text-[var(--text-primary)]">
            {run.id.slice(0, 8)}...
          </h1>
          <AgentStatusBadge status={run.status} />
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Mode</span>
            <div className="mt-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                run.mode === "review"
                  ? "bg-amber-500/10 text-amber-400"
                  : run.mode === "interactive"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-[var(--accent-purple)]/10 text-[var(--accent-purple)]"
              }`}>
                {run.mode === "review" ? "Code Review" : run.mode === "interactive" ? "Interactive" : "Implementation"}
              </span>
            </div>
          </div>
          {run.issueId && (
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Issue</span>
            <div className="mt-0.5">
              <Link href={`/issues/${run.issueId}`} className="font-mono text-xs text-[var(--accent-blue)] hover:underline">
                {run.issueId.slice(0, 8)}...
              </Link>
            </div>
          </div>
          )}
          {run.pullRequestId && (
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Pull Request</span>
            <div className="mt-0.5 font-mono text-xs text-[var(--accent-blue)]">
              {run.pullRequestId.slice(0, 8)}...
            </div>
          </div>
          )}
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Started</span>
            <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {new Date(run.startedAt).toLocaleString()}
            </div>
          </div>
          {run.completedAt && (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Completed</span>
              <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {new Date(run.completedAt).toLocaleString()}
              </div>
            </div>
          )}
          {run.branch && (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Branch</span>
              <div className="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">{run.branch}</div>
            </div>
          )}
          {run.prNumber && (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">PR</span>
              <div className="mt-0.5 font-mono text-xs text-[var(--accent-blue)]">#{run.prNumber}</div>
            </div>
          )}
        </div>
      </div>

      {/* Handoff modal */}
      {showHandoff && (
        <HandoffModal
          onHandoff={handleHandoff}
          onClose={() => setShowHandoff(false)}
        />
      )}

      {isInteractive ? (
        <InteractiveTerminalSection runId={run.id} isActive={isActive} isPaused={run.status === "paused"} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
              {run.mode === "review" ? "Review Output" : "Implementation Plan"}
            </h2>
            {run.mode === "review" && run.artifacts?.some((a) => a.type === "review") ? (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <pre className="whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                  {run.artifacts.find((a) => a.type === "review")?.content ?? "No review output"}
                </pre>
              </div>
            ) : (
              <AgentPlanViewer plan={run.plan as Parameters<typeof AgentPlanViewer>[0]["plan"]} />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
              Logs ({logs.length})
              {isActive && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-normal text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              )}
            </h2>
            <AgentLogViewer logs={logs} />
          </div>
        </div>
      )}

      {/* Logs section (also shown for interactive mode below terminal) */}
      {isInteractive && logs.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
            Agent Logs ({logs.length})
          </h2>
          <AgentLogViewer logs={logs} />
        </div>
      )}

      {run.artifacts && Array.isArray(run.artifacts) && run.artifacts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
            Artifacts ({run.artifacts.length})
          </h2>
          <div className="space-y-3">
            {run.artifacts.map((artifact, i) => (
              <div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-[var(--accent-blue)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent-blue)]">
                    {artifact.type}
                  </span>
                  {artifact.path && (
                    <span className="font-mono text-[var(--text-quaternary)]">{artifact.path}</span>
                  )}
                </div>
                {artifact.content && (
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-root)] p-3 font-mono text-xs text-[var(--text-tertiary)]">
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

// ─────────────────────────────────────────────────
// Interactive Terminal Section
// ─────────────────────────────────────────────────

function InteractiveTerminalSection({
  runId,
  isActive,
  isPaused,
}: {
  runId: string;
  isActive: boolean;
  isPaused: boolean;
}) {
  const {
    output,
    isStreaming,
    waitingForInput,
    status,
    sendInput,
    sendInterrupt,
  } = useTerminalStream(runId, true);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
        Terminal
        {isStreaming && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-normal text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        )}
        {isPaused && (
          <span className="ml-2 text-xs font-normal text-yellow-400">
            Session paused
          </span>
        )}
      </h2>
      <InteractiveTerminal output={output} isStreaming={isStreaming} />
      {isPaused ? (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-xs text-yellow-400">
          Session paused — use Resume to continue or Handoff to reassign.
        </div>
      ) : (
        <TerminalInputBar
          onSend={sendInput}
          onInterrupt={sendInterrupt}
          waitingForInput={waitingForInput}
          disabled={!isActive && !isStreaming}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Handoff Modal
// ─────────────────────────────────────────────────

function HandoffModal({
  onHandoff,
  onClose,
}: {
  onHandoff: (userId: string) => void;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Hand off session</h3>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Reassign this workspace to another team member.
        </p>
        <div className="mt-4">
          <label className="text-[11px] font-medium text-[var(--text-quaternary)]">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID..."
            className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-root)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent-blue)] focus:outline-none"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border-default)] px-4 py-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!userId.trim()) return;
              setSubmitting(true);
              await onHandoff(userId.trim());
              setSubmitting(false);
            }}
            disabled={!userId.trim() || submitting}
            className="rounded-lg bg-[var(--accent-blue)] px-4 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Handing off..." : "Handoff"}
          </button>
        </div>
      </div>
    </div>
  );
}
