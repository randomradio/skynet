"use client";

import Link from "next/link";

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

const TYPE_ICONS: Record<string, string> = {
  issue_created: "+",
  issue_updated: "~",
  issue_closed: "x",
  agent_started: ">",
  agent_completed: "v",
  pr_created: "PR",
};

const TYPE_COLORS: Record<string, string> = {
  issue_created: "bg-emerald-500/10 text-emerald-400",
  issue_updated: "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]",
  issue_closed: "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]",
  agent_started: "bg-purple-500/10 text-purple-400",
  agent_completed: "bg-emerald-500/10 text-emerald-400",
  pr_created: "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]",
};

interface ActivityFeedProps {
  activities: Activity[];
}

function getActivityHref(a: Activity): string | null {
  if (a.type === "agent_started" || a.type === "agent_completed" || a.type === "agent_failed") {
    if (a.agentRunId) return `/agents/${a.agentRunId}`;
  }
  if (a.repoOwner && a.repoName) {
    if (
      a.type === "issue_created" ||
      a.type === "issue_updated" ||
      a.type === "issue_closed"
    ) {
      return `/repos/${a.repoOwner}/${a.repoName}/issues`;
    }
    if (a.type === "pr_created" || a.type === "pr_merged") {
      return `/repos/${a.repoOwner}/${a.repoName}/pulls`;
    }
  }
  return null;
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <p className="text-xs text-[var(--text-quaternary)]">No recent activity.</p>
    );
  }

  return (
    <div className="stagger-children space-y-1.5">
      {activities.map((a) => {
        const href = getActivityHref(a);
        const content = (
          <>
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold ${TYPE_COLORS[a.type] ?? "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]"}`}
            >
              {TYPE_ICONS[a.type] ?? "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text-primary)]">{a.title}</p>
              {a.description && (
                <p className="text-xs text-[var(--text-quaternary)] line-clamp-1">{a.description}</p>
              )}
            </div>
            <span className="flex-shrink-0 text-xs text-[var(--text-quaternary)]">
              {timeAgo(a.createdAt)}
            </span>
          </>
        );

        const className =
          "flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm transition-colors hover:bg-[var(--bg-hover)]";

        return href ? (
          <Link key={a.id} href={href} className={className}>
            {content}
          </Link>
        ) : (
          <div key={a.id} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
