"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";

interface DashboardStats {
  openIssues: number;
  closedIssues: number;
  p0p1Issues: number;
}

interface Repository {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  lastSyncedAt: string | null;
}

interface AgentRunSummary {
  id: string;
  issueId: string;
  status: string;
  plan: unknown;
  branch: string | null;
  prNumber: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface WorkspaceSummary {
  id: string;
  issueId: string;
  issueTitle: string | null;
  status: string;
  assignedTo: string | null;
  sessionCount: number;
  updatedAt: string;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  actorType: string;
  repoOwner?: string;
  repoName?: string;
  issueNumber?: number;
  agentRunId?: string;
  createdAt: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRunSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, wsRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/agents/workspaces").catch(() => null),
        ]);
        const data = await dashRes.json();
        setStats(data.stats ?? null);
        setRepositories(data.repositories ?? []);
        setAgentRuns(data.recentAgentRuns ?? []);
        setActivities(data.recentActivity ?? []);
        if (wsRes?.ok) {
          const wsData = await wsRes.json();
          setWorkspaces(wsData.workspaces ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    { label: "Open Issues", value: stats?.openIssues ?? 0, color: "var(--accent-blue)", href: "/issues?state=open" },
    { label: "P0/P1 Issues", value: stats?.p0p1Issues ?? 0, color: "var(--accent-amber)", href: "/issues?ai_priority=P0" },
    { label: "Active Agents", value: agentRuns.filter((r) => !["completed", "failed", "cancelled"].includes(r.status)).length, color: "var(--accent-emerald)", href: "/agents" },
  ];

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Overview of your development activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="card-glow rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 transition-all hover:border-[var(--border-bright)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
              {card.label}
            </p>
            <p
              className="mt-3 text-3xl font-semibold tabular-nums"
              style={{ color: card.color }}
            >
              {loading ? "-" : String(card.value)}
            </p>
          </Link>
        ))}
      </div>

      {/* Repositories */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
          Repositories
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-quaternary)]">Loading...</p>
        ) : repositories.length === 0 ? (
          <p className="text-sm text-[var(--text-quaternary)]">No repositories synced yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <Link
                key={repo.id}
                href={`/repos/${repo.owner}/${repo.name}/issues`}
                className="card-glow rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-all hover:border-[var(--border-bright)]"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  <span className="text-[var(--text-tertiary)]">{repo.owner}</span>
                  <span className="mx-0.5 text-[var(--text-quaternary)]">/</span>
                  {repo.name}
                </p>
                {repo.description && (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-quaternary)] line-clamp-2">
                    {repo.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-[var(--text-quaternary)]">
                  Synced {timeAgo(repo.lastSyncedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Active Workspaces */}
      {workspaces.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
            Active Workspaces
          </h2>
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/issues/${ws.issueId}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                  ws.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-yellow-500/10 text-yellow-700"
                }`}>
                  {ws.status === "active" ? "Active" : "Paused"}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--text-primary)]">
                  {ws.issueTitle ?? ws.issueId.slice(0, 8)}
                </span>
                <span className="text-xs text-[var(--text-quaternary)]">
                  Session #{ws.sessionCount}
                </span>
                <span className="flex-shrink-0 text-xs text-[var(--text-quaternary)]">
                  {timeAgo(ws.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Agent Runs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
            Recent Agent Runs
          </h2>
          <Link
            href="/agents"
            className="text-xs text-[var(--text-quaternary)] transition-colors hover:text-[var(--text-secondary)]"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-quaternary)]">Loading...</p>
        ) : agentRuns.length === 0 ? (
          <p className="text-sm text-[var(--text-quaternary)]">No agent runs yet.</p>
        ) : (
          <div className="space-y-2">
            {agentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/agents/${run.id}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm transition-colors hover:bg-[var(--bg-hover)]"
              >
                <AgentStatusBadge status={run.status} />
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--text-primary)]">
                  {run.branch ?? run.id.slice(0, 8)}
                </span>
                {run.prNumber != null && (
                  <span className="font-mono text-xs text-[var(--accent-cyan)]">
                    PR #{run.prNumber}
                  </span>
                )}
                <span className="flex-shrink-0 text-xs text-[var(--text-quaternary)]">
                  {timeAgo(run.startedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
          Recent Activity
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-quaternary)]">Loading...</p>
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </section>
  );
}
