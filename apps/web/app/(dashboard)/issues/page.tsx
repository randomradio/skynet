"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState("");
  const [aiType, setAiType] = useState("");
  const [aiPriority, setAiPriority] = useState("");

  const fetchIssues = useCallback(async (page: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (state) params.set("state", state);
    if (aiType) params.set("ai_type", aiType);
    if (aiPriority) params.set("ai_priority", aiPriority);

    try {
      const res = await fetch(`/api/issues?${params}`);
      const data = await res.json();
      setIssues(data.issues ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0 });
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [state, aiType, aiPriority]);

  useEffect(() => {
    fetchIssues(1);
  }, [fetchIssues]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
          <p className="text-sm text-slate-500">
            {pagination.total} issue{pagination.total !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      <IssueFilters
        state={state}
        aiType={aiType}
        aiPriority={aiPriority}
        onStateChange={setState}
        onAiTypeChange={setAiType}
        onAiPriorityChange={setAiPriority}
      />

      {loading ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">
          Loading issues...
        </div>
      ) : (
        <IssueList issues={issues} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchIssues(pagination.page - 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            disabled={pagination.page >= totalPages}
            onClick={() => fetchIssues(pagination.page + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
