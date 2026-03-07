import { NextRequest, NextResponse } from "next/server";

import { withRepoAccess } from "@/lib/auth/with-repo-access";
import { getGitHubClient, hasGitHubToken } from "@/lib/github/client";
import { extractLinkedIssues } from "@/lib/github/sync-pr";
import {
  getPullRequestByNumber,
  getIssueByNumber,
  upsertPullRequestFromGitHub,
} from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

function mapGitHubPullRequestToDb(input: {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  head: { ref: string };
  base: { ref: string };
  user: { id: number };
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
}, owner: string, repo: string) {
  return {
    githubId: input.id,
    number: input.number,
    repoOwner: owner,
    repoName: repo,
    title: input.title,
    body: input.body,
    state: input.merged ? "merged" : input.state,
    headBranch: input.head.ref,
    baseBranch: input.base.ref,
    authorGithubId: input.user.id,
    linkedIssueNumbers: extractLinkedIssues(input.body, input.head.ref),
    additions: input.additions,
    deletions: input.deletions,
    changedFiles: input.changed_files,
    createdAt: new Date(input.created_at),
    updatedAt: new Date(input.updated_at),
    mergedAt: input.merged_at ? new Date(input.merged_at) : null,
  } as const;
}

export const GET = withRepoAccess(async (
  _request: NextRequest,
  _user,
  context: { params: Promise<Record<string, string>> },
): Promise<NextResponse> => {
  const { owner, name, number: numStr } = await context.params;
  const prNumber = Number.parseInt(numStr, 10);

  if (Number.isNaN(prNumber)) {
    const body: ApiErrorResponse = {
      error: { code: "BAD_REQUEST", message: "Invalid pull request number" },
    };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    let pr = await getPullRequestByNumber(owner, name, prNumber);
    if (!pr && hasGitHubToken()) {
      try {
        const githubPr = await getGitHubClient().getPullRequest(owner, name, prNumber);
        await upsertPullRequestFromGitHub(
          mapGitHubPullRequestToDb(githubPr, owner, name),
        );
        pr = await getPullRequestByNumber(owner, name, prNumber);
      } catch {
        // fall through to 404 below
      }
    }

    if (!pr) {
      const body: ApiErrorResponse = {
        error: { code: "NOT_FOUND", message: "Pull request not found" },
      };
      return NextResponse.json(body, { status: 404 });
    }

    const linkedNumbers = Array.isArray(pr.linkedIssueNumbers)
      ? (pr.linkedIssueNumbers as number[])
      : [];

    const linkedIssues = await Promise.all(
      linkedNumbers.map(async (issueNum) => {
        const issue = await getIssueByNumber(owner, name, issueNum);
        if (!issue) return null;
        return { id: issue.id, number: issue.number, title: issue.title, state: issue.state };
      }),
    );

    return NextResponse.json({
      pullRequest: {
        id: pr.id,
        number: pr.number,
        repoOwner: pr.repoOwner,
        repoName: pr.repoName,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        headBranch: pr.headBranch,
        baseBranch: pr.baseBranch,
        authorGithubId: pr.authorGithubId,
        linkedIssueNumbers: pr.linkedIssueNumbers,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        createdAt: pr.createdAt?.toISOString() ?? null,
        updatedAt: pr.updatedAt?.toISOString() ?? null,
        mergedAt: pr.mergedAt?.toISOString() ?? null,
      },
      linkedIssues: linkedIssues.filter(Boolean),
    });
  } catch {
    const body: ApiErrorResponse = {
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Pull request data is temporarily unavailable",
      },
    };
    return NextResponse.json(body, { status: 503 });
  }
});
