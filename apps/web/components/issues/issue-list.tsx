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

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">
        No issues found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50 text-left text-xs font-medium text-slate-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {issues.map((issue) => (
            <tr key={issue.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">{issue.number}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/issues/${issue.id}`}
                  className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                >
                  {issue.title}
                </Link>
                {issue.aiSummary && (
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {issue.aiSummary}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    issue.state === "open"
                      ? "bg-green-100 text-green-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {issue.state}
                </span>
              </td>
              <td className="px-4 py-3">
                <TypeBadge type={issue.aiType} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={issue.aiPriority} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                {timeAgo(issue.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
