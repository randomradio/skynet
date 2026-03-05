"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PrStateBadge } from "@/components/pulls/pr-state-badge";
import { RichText } from "@/components/rich-text/rich-text";
import { DiffViewer } from "@/components/code-review/diff-viewer";
import { ReviewPanel } from "@/components/code-review/review-panel";
import { CodeBrowser } from "@/components/code-browser/code-browser";
import type { ReviewFinding } from "@/lib/types/code-review";

interface PullRequestDetail {
  id: string;
  number: number;
  repoOwner: string;
  repoName: string;
  title: string;
  body: string | null;
  state: string;
  headBranch: string;
  baseBranch: string;
  authorGithubId: number | null;
  linkedIssueNumbers: number[] | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  mergedAt: string | null;
}

interface LinkedIssue {
  id: string;
  number: number;
  title: string;
  state: string;
}

interface ReviewData {
  agentRunId: string;
  status: string;
  findings: ReviewFinding[];
}

type Tab = "overview" | "files" | "review" | "browse";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrDetailPage() {
  const params = useParams<{ owner: string; name: string; number: string }>();
  const router = useRouter();
  const [pr, setPr] = useState<PullRequestDetail | null>(null);
  const [linkedIssues, setLinkedIssues] = useState<LinkedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingReview, setStartingReview] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [reviewFindings, setReviewFindings] = useState<ReviewFinding[]>([]);
  const [scrollToFile, setScrollToFile] = useState<string | undefined>();
  const [scrollToLine, setScrollToLine] = useState<number | undefined>();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/repos/${params.owner}/${params.name}/pulls/${params.number}`,
        );
        if (!res.ok) {
          setError(res.status === 404 ? "Pull request not found" : "Failed to load");
          return;
        }
        const data = await res.json();
        setPr(data.pullRequest);
        setLinkedIssues(data.linkedIssues ?? []);
      } catch {
        setError("Failed to load pull request");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.owner, params.name, params.number]);

  // Fetch review data once for cross-tab usage
  useEffect(() => {
    async function loadReview() {
      try {
        const res = await fetch(
          `/api/repos/${params.owner}/${params.name}/pulls/${params.number}/review`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.review?.findings) {
            setReviewFindings(data.review.findings);
          }
        }
      } catch {
        // ignore
      }
    }
    loadReview();
  }, [params.owner, params.name, params.number]);

  const handleStartReview = useCallback(async () => {
    if (!pr) return;
    setStartingReview(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pullRequestId: pr.id, mode: "review" }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/agents/${data.id}`);
      }
    } catch {
      // Ignore
    } finally {
      setStartingReview(false);
    }
  }, [pr, router]);

  const handleFindingClick = useCallback((file: string, line: number) => {
    setScrollToFile(file);
    setScrollToLine(line);
    setActiveTab("files");
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-quaternary)]">
        Loading pull request...
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-tertiary)]">
        {error ?? "Pull request not found"}
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "files", label: `Files Changed${pr.changedFiles != null ? ` (${pr.changedFiles})` : ""}` },
    { id: "review", label: "AI Review" },
    { id: "browse", label: "Browse" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {pr.title}
            <span className="ml-2 font-mono text-[var(--text-quaternary)]">#{pr.number}</span>
          </h2>
          <div className="mt-1">
            <PrStateBadge state={pr.state} />
          </div>
        </div>
        <a
          href={`https://github.com/${params.owner}/${params.name}/pull/${pr.number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
        >
          View on GitHub
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[var(--accent-blue)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metadata grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
                Branch
              </p>
              <p className="mt-1 font-mono text-sm text-[var(--text-secondary)]">
                {pr.headBranch}
                <span className="mx-1.5 text-[var(--text-quaternary)]">&rarr;</span>
                {pr.baseBranch}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
                Created
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(pr.createdAt)}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
                {pr.mergedAt ? "Merged" : "Updated"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {formatDate(pr.mergedAt ?? pr.updatedAt)}
              </p>
            </div>
          </div>

          {/* Stats */}
          {(pr.changedFiles != null || pr.additions != null || pr.deletions != null) && (
            <div className="flex gap-4">
              {pr.changedFiles != null && (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                  <span className="text-xs text-[var(--text-quaternary)]">Files changed</span>
                  <span className="ml-2 font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {pr.changedFiles}
                  </span>
                </div>
              )}
              {pr.additions != null && (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                  <span className="text-xs text-[var(--text-quaternary)]">Additions</span>
                  <span className="ml-2 font-mono text-sm font-semibold text-emerald-400">
                    +{pr.additions}
                  </span>
                </div>
              )}
              {pr.deletions != null && (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                  <span className="text-xs text-[var(--text-quaternary)]">Deletions</span>
                  <span className="ml-2 font-mono text-sm font-semibold text-red-400">
                    -{pr.deletions}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {pr.body && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Description</h3>
              <RichText
                content={pr.body}
                format="markdown"
                repoContext={{ owner: params.owner, name: params.name }}
              />
            </div>
          )}

          {/* Linked Issues */}
          {linkedIssues.length > 0 && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Linked Issues</h3>
              <div className="space-y-2">
                {linkedIssues.map((issue) => (
                  <a
                    key={issue.id}
                    href={`https://github.com/${params.owner}/${params.name}/issues/${issue.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span className="font-mono text-xs text-[var(--text-quaternary)]">
                      #{issue.number}
                    </span>
                    <span className="text-[var(--text-primary)]">{issue.title}</span>
                    <span
                      className={`ml-auto text-xs font-medium ${
                        issue.state === "open" ? "text-emerald-400" : "text-[var(--text-quaternary)]"
                      }`}
                    >
                      {issue.state}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* AI Code Review CTA */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">AI Code Review</h3>
                <p className="mt-1 text-xs text-[var(--text-quaternary)]">
                  Run AI-powered code review on this pull request
                </p>
              </div>
              <button
                onClick={handleStartReview}
                disabled={startingReview}
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-[var(--accent-purple)] to-purple-600 px-4 py-2 text-xs font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--glow-purple)] disabled:opacity-50"
              >
                {startingReview ? "Starting..." : "Start AI Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "files" && (
        <DiffViewer
          owner={params.owner}
          name={params.name}
          prNumber={parseInt(params.number, 10)}
          findings={reviewFindings}
          scrollToFile={scrollToFile}
          scrollToLine={scrollToLine}
        />
      )}

      {activeTab === "review" && (
        <ReviewPanel
          owner={params.owner}
          name={params.name}
          prNumber={parseInt(params.number, 10)}
          onFindingClick={handleFindingClick}
        />
      )}

      {activeTab === "browse" && (
        <CodeBrowser
          owner={params.owner}
          name={params.name}
          prNumber={parseInt(params.number, 10)}
          findings={reviewFindings}
        />
      )}
    </div>
  );
}
