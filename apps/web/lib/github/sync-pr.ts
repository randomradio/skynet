import {
  upsertPullRequestFromGitHub,
  insertActivity,
  getDiscussionByIssueId,
  getIssueByNumber,
  insertMessage,
} from "@skynet/db";

export interface WebhookPullRequestPayload {
  action: string;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed";
    merged: boolean;
    head: { ref: string; sha: string };
    base: { ref: string };
    user: { login: string; id: number };
    labels: Array<{ name: string }>;
    additions: number;
    deletions: number;
    changed_files: number;
    created_at: string;
    updated_at: string;
    merged_at: string | null;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
}

/**
 * Extract linked issue numbers from PR body and branch name.
 * Matches: #123, fixes #123, closes #123, resolves #123
 * Branch patterns: feat/issue-123, fix/123-desc
 */
export function extractLinkedIssues(
  body: string | null,
  branch: string,
): number[] {
  const issueNumbers = new Set<number>();

  if (body) {
    // Match: fixes #123, closes #123, resolves #123, fix #123, close #123, resolve #123
    const keywordPattern =
      /(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
    let match;
    while ((match = keywordPattern.exec(body)) !== null) {
      issueNumbers.add(parseInt(match[1]!, 10));
    }

    // Match standalone #123 references (not preceded by keyword — still useful context)
    const refPattern = /(?<!\w)#(\d+)\b/g;
    while ((match = refPattern.exec(body)) !== null) {
      issueNumbers.add(parseInt(match[1]!, 10));
    }
  }

  // Match branch names like: feat/issue-123, fix/123-desc, issue-42
  const branchPattern = /(?:issue[/-])(\d+)/i;
  const branchMatch = branch.match(branchPattern);
  if (branchMatch) {
    issueNumbers.add(parseInt(branchMatch[1]!, 10));
  }

  // Also match: fix/123-desc (number right after first slash)
  const branchNumPattern = /^[a-z]+\/(\d+)(?:-|$)/i;
  const branchNumMatch = branch.match(branchNumPattern);
  if (branchNumMatch) {
    issueNumbers.add(parseInt(branchNumMatch[1]!, 10));
  }

  return [...issueNumbers];
}

function formatPRState(pr: WebhookPullRequestPayload["pull_request"]): "open" | "closed" | "merged" {
  if (pr.merged) return "merged";
  return pr.state;
}

function buildSystemMessage(
  action: string,
  pr: WebhookPullRequestPayload["pull_request"],
): string {
  const state = formatPRState(pr);
  const stats = `${pr.changed_files} file${pr.changed_files !== 1 ? "s" : ""}, +${pr.additions} -${pr.deletions}`;

  switch (action) {
    case "opened":
      return `PR #${pr.number} "${pr.title}" (by @${pr.user.login}) has been opened, referencing this issue. Branch: ${pr.head.ref}. Changes: ${stats}.`;
    case "closed":
      if (pr.merged) {
        return `PR #${pr.number} "${pr.title}" has been merged. Branch: ${pr.head.ref}. Changes: ${stats}.`;
      }
      return `PR #${pr.number} "${pr.title}" has been closed without merging.`;
    case "synchronize":
      return `PR #${pr.number} "${pr.title}" has been updated with new commits. Branch: ${pr.head.ref}. Changes: ${stats}.`;
    case "edited":
      return `PR #${pr.number} "${pr.title}" description has been updated.`;
    default:
      return `PR #${pr.number} "${pr.title}" — event: ${action}.`;
  }
}

export async function syncPRFromWebhook(
  payload: WebhookPullRequestPayload,
): Promise<string> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pr = payload.pull_request;

  const linkedIssues = extractLinkedIssues(pr.body, pr.head.ref);

  const prId = await upsertPullRequestFromGitHub({
    githubId: pr.id,
    number: pr.number,
    repoOwner: owner,
    repoName: repo,
    title: pr.title,
    body: pr.body,
    state: formatPRState(pr),
    headBranch: pr.head.ref,
    baseBranch: pr.base.ref,
    authorGithubId: pr.user.id,
    linkedIssueNumbers: linkedIssues,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    createdAt: new Date(pr.created_at),
    updatedAt: new Date(pr.updated_at),
    mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
  });

  // Log activity
  const activityType = pr.merged ? "pr_merged" : "pr_created";
  await insertActivity({
    type: activityType,
    repoOwner: owner,
    repoName: repo,
    issueNumber: linkedIssues[0] ?? undefined,
    actorType: "system",
    title: `PR #${pr.number} ${payload.action}`,
    description: pr.title,
  }).catch(() => {});

  // For each linked issue, post a system message to the discussion
  const systemMessage = buildSystemMessage(payload.action, pr);

  for (const issueNumber of linkedIssues) {
    try {
      const issue = await getIssueByNumber(owner, repo, issueNumber);
      if (!issue) continue;

      const discussion = await getDiscussionByIssueId(issue.id);
      if (!discussion || discussion.finalized) continue;

      await insertMessage({
        discussionId: discussion.id,
        authorId: null,
        authorType: "system",
        content: systemMessage,
      });
    } catch {
      // Best-effort: don't fail the webhook if discussion messaging fails
    }
  }

  return prId;
}
