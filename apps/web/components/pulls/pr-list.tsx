"use client";

import Link from "next/link";
import { PrStateBadge } from "./pr-state-badge";
import { ReferenceLink } from "@/components/rich-text/reference-link";

interface PullRequest {
  id: string;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  state: string;
  headBranch: string;
  baseBranch: string;
  linkedIssueNumbers: number[] | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  updatedAt: string | null;
}

interface PrListProps {
  pullRequests: PullRequest[];
  owner: string;
  name: string;
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

export function PrList({ pullRequests, owner, name }: PrListProps) {
  if (pullRequests.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-tertiary)]">
        No pull requests found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Changes</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {pullRequests.map((pr) => {
            const linkedNums = Array.isArray(pr.linkedIssueNumbers)
              ? pr.linkedIssueNumbers
              : [];

            return (
              <tr key={pr.id} className="transition-colors hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-quaternary)]">
                  <a
                    href={`https://github.com/${owner}/${name}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--accent-blue)]"
                  >
                    {pr.number}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/repos/${owner}/${name}/pulls/${pr.number}`}
                    className="font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-blue)]"
                  >
                    {pr.title}
                  </Link>
                  {linkedNums.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {linkedNums.map((num) => (
                        <ReferenceLink
                          key={num}
                          segment={{ type: "issue_ref", value: `#${num}`, meta: String(num) }}
                          repoContext={{ owner, name }}
                        />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PrStateBadge state={pr.state} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--text-tertiary)]">
                    {pr.headBranch}
                    <span className="mx-1 text-[var(--text-quaternary)]">&rarr;</span>
                    {pr.baseBranch}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {pr.additions != null && (
                    <span className="text-emerald-400">+{pr.additions}</span>
                  )}
                  {pr.additions != null && pr.deletions != null && (
                    <span className="mx-1 text-[var(--text-quaternary)]">/</span>
                  )}
                  {pr.deletions != null && (
                    <span className="text-red-400">-{pr.deletions}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-quaternary)]">
                  {timeAgo(pr.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
