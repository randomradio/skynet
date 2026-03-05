"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AIAnalysisPanel } from "@/components/issues/ai-analysis-panel";
import { CodeContextPanel } from "@/components/issues/code-context-panel";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { TypeBadge } from "@/components/issues/type-badge";
import { RichText } from "@/components/rich-text/rich-text";

interface IssueDetail {
  id: string;
  githubId: number;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: string[];
  aiType: string | null;
  aiPriority: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  aiAnalysis: Record<string, unknown> | null;
  lastAnalyzedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WorkspaceInfo {
  id: string;
  status: string;
  assignedTo: string | null;
  sessionCount: number;
  updatedAt: string;
}

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingAgent, setStartingAgent] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/issues/${params.id}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error.message);
        } else {
          setIssue(data.issue);
          // Check for existing workspace
          try {
            const wsRes = await fetch(`/api/agents/workspaces?status=paused`);
            const wsData = await wsRes.json();
            const ws = wsData.workspaces?.find(
              (w: WorkspaceInfo & { issueId: string }) => w.issueId === data.issue?.id,
            );
            if (ws) setWorkspace(ws);
          } catch {
            // best effort
          }
          // Also check active workspaces
          try {
            const wsRes = await fetch(`/api/agents/workspaces?status=active`);
            const wsData = await wsRes.json();
            const ws = wsData.workspaces?.find(
              (w: WorkspaceInfo & { issueId: string }) => w.issueId === data.issue?.id,
            );
            if (ws) setWorkspace(ws);
          } catch {
            // best effort
          }
        }
      } catch {
        setError("Failed to load issue");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleStartAgent = useCallback(async () => {
    if (!issue) return;
    setStartingAgent(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, mode: "develop" }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/agents/${data.id}`);
      }
    } catch {
      // Ignore
    } finally {
      setStartingAgent(false);
    }
  }, [issue, router]);

  if (loading) {
    return <div className="text-sm text-[var(--text-quaternary)]">Loading...</div>;
  }

  if (error || !issue) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-400">{error ?? "Issue not found"}</p>
        <Link href="/issues" className="text-sm text-[var(--accent-blue)] hover:underline">
          Back to issues
        </Link>
      </div>
    );
  }

  const labels = Array.isArray(issue.labels) ? issue.labels : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/issues" className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-blue)]">
          &larr; Back to issues
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <a
                href={`https://github.com/${issue.repoOwner}/${issue.repoName}/issues/${issue.number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--text-quaternary)] hover:text-[var(--accent-blue)] hover:underline"
              >
                {issue.repoOwner}/{issue.repoName} #{issue.number}
              </a>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                  issue.state === "open"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  issue.state === "open" ? "bg-emerald-400" : "bg-[var(--text-quaternary)]"
                }`} />
                {issue.state}
              </span>
              <TypeBadge type={issue.aiType} />
              <PriorityBadge priority={issue.aiPriority} />
            </div>

            <h1 className="text-lg font-semibold text-[var(--text-primary)]">{issue.title}</h1>

            {labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {issue.body && (
              <div className="mt-4">
                <RichText
                  content={issue.body}
                  format="markdown"
                  repoContext={{ owner: issue.repoOwner, name: issue.repoName }}
                />
              </div>
            )}

            {issue.createdAt && (
              <p className="mt-4 text-xs text-[var(--text-quaternary)]">
                Created {new Date(issue.createdAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Workspace banner */}
          {workspace && (
            <div className={`flex items-center justify-between rounded-lg border px-4 py-2 text-xs ${
              workspace.status === "active"
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                : "border-yellow-500/20 bg-yellow-500/5 text-yellow-400"
            }`}>
              <span>
                {workspace.status === "active"
                  ? `Active workspace — session #${workspace.sessionCount}`
                  : `Paused workspace — session #${workspace.sessionCount}, last active ${new Date(workspace.updatedAt).toLocaleString()}`}
              </span>
              {workspace.status === "paused" && (
                <div className="flex gap-2">
                  <button
                    onClick={handleStartAgent}
                    disabled={startingAgent}
                    className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20"
                  >
                    Resume
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href={`/issues/${issue.id}/discussion`}
              className="inline-flex items-center rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
            >
              Start Discussion
            </Link>
            <button
              onClick={handleStartAgent}
              disabled={startingAgent}
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-[var(--accent-purple)] to-purple-600 px-4 py-2 text-xs font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--glow-purple)] disabled:opacity-50"
            >
              {startingAgent ? "Starting..." : workspace ? "Resume Session" : "Start Implementation"}
            </button>
          </div>
        </div>

        {/* AI Analysis sidebar */}
        <div className="space-y-4">
          <AIAnalysisPanel
            issueId={issue.id}
            aiType={issue.aiType}
            aiPriority={issue.aiPriority}
            aiSummary={issue.aiSummary}
            aiTags={issue.aiTags}
            aiAnalysis={issue.aiAnalysis as Parameters<typeof AIAnalysisPanel>[0]["aiAnalysis"]}
            lastAnalyzedAt={issue.lastAnalyzedAt}
          />
          <CodeContextPanel issueId={issue.id} />
        </div>
      </div>
    </div>
  );
}
