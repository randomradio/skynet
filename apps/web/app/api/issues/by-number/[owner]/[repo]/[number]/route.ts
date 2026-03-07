import { NextResponse } from "next/server";

import { withRepoAccess } from "@/lib/auth/with-repo-access";
import { getGitHubClient, hasGitHubToken } from "@/lib/github/client";
import { getIssueByNumber, upsertIssueFromGitHub } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

function mapGitHubIssueToDb(input: {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name: string }>;
  assignee: { id: number } | null;
  created_at: string;
  updated_at: string;
}, owner: string, repo: string) {
  return {
    githubId: input.id,
    number: input.number,
    repoOwner: owner,
    repoName: repo,
    title: input.title,
    body: input.body,
    state: input.state,
    labels: input.labels.map((label) => label.name),
    assigneeGithubId: input.assignee?.id ?? null,
    createdAt: new Date(input.created_at),
    updatedAt: new Date(input.updated_at),
  } as const;
}

export const GET = withRepoAccess(
  async (
    request,
    _user,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const { owner, repo, number } = await context.params;
    const num = parseInt(number ?? "", 10);
    if (isNaN(num)) {
      const body: ApiErrorResponse = {
        error: { code: "BAD_REQUEST", message: "Invalid issue number" },
      };
      return NextResponse.json(body, { status: 400 });
    }

    let issue = await getIssueByNumber(owner, repo, num);
    if (!issue && hasGitHubToken()) {
      try {
        const githubIssue = await getGitHubClient().getIssue(owner, repo, num);
        await upsertIssueFromGitHub(mapGitHubIssueToDb(githubIssue, owner, repo));
        issue = await getIssueByNumber(owner, repo, num);
      } catch {
        // fall through to 404 below
      }
    }

    if (!issue) {
      const body: ApiErrorResponse = {
        error: { code: "NOT_FOUND", message: "Issue not found" },
      };
      return NextResponse.json(body, { status: 404 });
    }

    return NextResponse.redirect(new URL(`/issues/${issue.id}`, request.url));
  },
  { ownerParam: "owner", nameParam: "repo" },
);
