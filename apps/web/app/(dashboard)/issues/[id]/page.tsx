"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AIAnalysisPanel } from "@/components/issues/ai-analysis-panel";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { TypeBadge } from "@/components/issues/type-badge";

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

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
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
        body: JSON.stringify({ issueId: issue.id }),
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
    return <div className="text-sm text-slate-500">Loading...</div>;
  }

  if (error || !issue) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error ?? "Issue not found"}</p>
        <Link href="/issues" className="text-sm text-blue-600 hover:underline">
          Back to issues
        </Link>
      </div>
    );
  }

  const labels = Array.isArray(issue.labels) ? issue.labels : [];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/issues" className="text-sm text-blue-600 hover:underline">
          &larr; Back to issues
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">
                {issue.repoOwner}/{issue.repoName} #{issue.number}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  issue.state === "open"
                    ? "bg-green-100 text-green-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {issue.state}
              </span>
              <TypeBadge type={issue.aiType} />
              <PriorityBadge priority={issue.aiPriority} />
            </div>

            <h1 className="text-xl font-semibold text-slate-900">{issue.title}</h1>

            {labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {issue.body && (
              <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
                {issue.body}
              </div>
            )}

            {issue.createdAt && (
              <p className="mt-4 text-xs text-slate-400">
                Created {new Date(issue.createdAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/issues/${issue.id}/discussion`}
              className="inline-flex items-center rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Start Discussion
            </Link>
            <button
              onClick={handleStartAgent}
              disabled={startingAgent}
              className="inline-flex items-center rounded bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
            >
              {startingAgent ? "Starting..." : "Start Implementation"}
            </button>
          </div>
        </div>

        {/* AI Analysis sidebar */}
        <div>
          <AIAnalysisPanel
            issueId={issue.id}
            aiType={issue.aiType}
            aiPriority={issue.aiPriority}
            aiSummary={issue.aiSummary}
            aiTags={issue.aiTags}
            aiAnalysis={issue.aiAnalysis as Parameters<typeof AIAnalysisPanel>[0]["aiAnalysis"]}
            lastAnalyzedAt={issue.lastAnalyzedAt}
          />
        </div>
      </div>
    </div>
  );
}
