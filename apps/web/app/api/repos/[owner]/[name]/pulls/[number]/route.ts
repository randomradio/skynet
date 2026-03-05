import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/with-auth";
import { getPullRequestByNumber, getIssueByNumber } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

export const GET = withAuth(async (
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
    const pr = await getPullRequestByNumber(owner, name, prNumber);

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
