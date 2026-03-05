"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PrList } from "@/components/pulls/pr-list";

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

const STATE_FILTERS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "merged", label: "Merged" },
];

export default function RepoPullsPage() {
  const params = useParams<{ owner: string; name: string }>();
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");

  const fetchPulls = useCallback(async (page: number) => {
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", "20");
    if (stateFilter) sp.set("state", stateFilter);

    try {
      const res = await fetch(`/api/repos/${params.owner}/${params.name}/pulls?${sp}`);
      const data = await res.json();
      setPullRequests(data.pullRequests ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0 });
    } catch {
      setPullRequests([]);
    } finally {
      setLoading(false);
    }
  }, [params.owner, params.name, stateFilter]);

  useEffect(() => {
    fetchPulls(1);
  }, [fetchPulls]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const btnClasses =
    "rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:hover:bg-[var(--bg-secondary)]";

  return (
    <div className="space-y-5">
      <p className="text-xs text-[var(--text-quaternary)]">
        {pagination.total} pull request{pagination.total !== 1 ? "s" : ""} in this repository
      </p>

      <div className="flex gap-2">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStateFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              stateFilter === f.value
                ? "border border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                : "border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-quaternary)]">
          Loading pull requests...
        </div>
      ) : (
        <PrList pullRequests={pullRequests} owner={params.owner} name={params.name} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchPulls(pagination.page - 1)}
            className={btnClasses}
          >
            Previous
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            disabled={pagination.page >= totalPages}
            onClick={() => fetchPulls(pagination.page + 1)}
            className={btnClasses}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
