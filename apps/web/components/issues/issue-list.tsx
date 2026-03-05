"use client";

import Link from "next/link";
import { PriorityBadge } from "./priority-badge";
import { TypeBadge } from "./type-badge";

interface Issue {
  id: string;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  state: "open" | "closed";
  aiType: string | null;
  aiPriority: string | null;
  aiSummary: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface IssueListProps {
  issues: Issue[];
  showRepo?: boolean;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function IssueList({ issues, showRepo }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-tertiary)]">
        No issues found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
          <tr>
            <th className="px-4 py-3.5">#</th>
            <th className="px-4 py-3.5">Title</th>
            {showRepo && <th className="px-4 py-3.5">Repo</th>}
            <th className="px-4 py-3.5">State</th>
            <th className="px-4 py-3.5">Type</th>
            <th className="px-4 py-3.5">Priority</th>
            <th className="px-4 py-3.5">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {issues.map((issue) => (
            <tr key={issue.id} className="transition-colors hover:bg-[var(--bg-hover)]">
              <td className="px-4 py-3 font-mono text-xs text-[var(--text-quaternary)]">
                <a
                  href={`https://github.com/${issue.repoOwner}/${issue.repoName}/issues/${issue.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--accent-blue)]"
                >
                  {issue.number}
                </a>
              </td>
              <td className="px-4 py-3.5">
                <Link
                  href={`/issues/${issue.id}`}
                  className="font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-blue)]"
                >
                  {issue.title}
                </Link>
                {issue.aiSummary && (
                  <p className="mt-0.5 text-xs text-[var(--text-quaternary)] line-clamp-1">
                    {issue.aiSummary}
                  </p>
                )}
              </td>
              {showRepo && (
                <td className="whitespace-nowrap px-4 py-3">
                  <a
                    href={`https://github.com/${issue.repoOwner}/${issue.repoName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-blue)]"
                  >
                    {issue.repoOwner}/{issue.repoName}
                  </a>
                </td>
              )}
              <td className="px-4 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    issue.state === "open"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    issue.state === "open" ? "bg-emerald-400" : "bg-[var(--text-quaternary)]"
                  }`} />
                  {issue.state}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <TypeBadge type={issue.aiType} />
              </td>
              <td className="px-4 py-3.5">
                <PriorityBadge priority={issue.aiPriority} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-quaternary)]">
                {timeAgo(issue.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
