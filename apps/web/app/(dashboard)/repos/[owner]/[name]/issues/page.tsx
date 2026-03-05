"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IssueList } from "@/components/issues/issue-list";
import { IssueFilters } from "@/components/issues/issue-filters";

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export default function RepoIssuesPage() {
  const params = useParams<{ owner: string; name: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState("");
  const [aiType, setAiType] = useState("");
  const [aiPriority, setAiPriority] = useState("");

  const fetchIssues = useCallback(async (page: number) => {
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("limit", "20");
    sp.set("repo_owner", params.owner);
    sp.set("repo_name", params.name);
    if (state) sp.set("state", state);
    if (aiType) sp.set("ai_type", aiType);
    if (aiPriority) sp.set("ai_priority", aiPriority);

    try {
      const res = await fetch(`/api/issues?${sp}`);
      const data = await res.json();
      setIssues(data.issues ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0 });
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [params.owner, params.name, state, aiType, aiPriority]);

  useEffect(() => {
    fetchIssues(1);
  }, [fetchIssues]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const btnClasses =
    "rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:hover:bg-[var(--bg-secondary)]";

  return (
    <div className="space-y-5">
      <p className="text-xs text-[var(--text-quaternary)]">
        {pagination.total} issue{pagination.total !== 1 ? "s" : ""} in this repository
      </p>

      <IssueFilters
        state={state}
        aiType={aiType}
        aiPriority={aiPriority}
        onStateChange={setState}
        onAiTypeChange={setAiType}
        onAiPriorityChange={setAiPriority}
      />

      {loading ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-quaternary)]">
          Loading issues...
        </div>
      ) : (
        <IssueList issues={issues} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchIssues(pagination.page - 1)}
            className={btnClasses}
          >
            Previous
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            disabled={pagination.page >= totalPages}
            onClick={() => fetchIssues(pagination.page + 1)}
            className={btnClasses}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
