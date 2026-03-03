import {
  upsertIssueFromGitHub,
  insertActivity,
} from "@skynet/db";
import { getGitHubClient, type GitHubIssue } from "./client";

interface WebhookIssuePayload {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed";
    labels: Array<{ name: string }>;
    assignee: { id: number } | null;
    created_at: string;
    updated_at: string;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
}

function mapGitHubIssue(
  ghIssue: GitHubIssue | WebhookIssuePayload["issue"],
  repoOwner: string,
  repoName: string,
) {
  return {
    githubId: ghIssue.id,
    number: ghIssue.number,
    repoOwner,
    repoName,
    title: ghIssue.title,
    body: ghIssue.body,
    state: ghIssue.state as "open" | "closed",
    labels: ghIssue.labels.map((l) => l.name),
    assigneeGithubId: ghIssue.assignee?.id ?? null,
    createdAt: new Date(ghIssue.created_at),
    updatedAt: new Date(ghIssue.updated_at),
  };
}

const ACTION_TO_ACTIVITY: Record<string, "issue_created" | "issue_updated" | "issue_closed"> = {
  opened: "issue_created",
  edited: "issue_updated",
  closed: "issue_closed",
  reopened: "issue_updated",
};

export async function syncIssueFromWebhook(payload: WebhookIssuePayload): Promise<string> {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const mapped = mapGitHubIssue(payload.issue, owner, repo);
  const issueId = await upsertIssueFromGitHub(mapped);

  const activityType = ACTION_TO_ACTIVITY[payload.action];
  if (activityType) {
    await insertActivity({
      type: activityType,
      repoOwner: owner,
      repoName: repo,
      issueNumber: payload.issue.number,
      actorType: "system",
      title: `Issue #${payload.issue.number} ${payload.action}`,
      description: payload.issue.title,
    });
  }

  return issueId;
}

export async function fullSyncRepository(owner: string, repo: string): Promise<number> {
  const client = getGitHubClient();
  let synced = 0;
  let page = 1;

  while (true) {
    const ghIssues = await client.listIssues(owner, repo, {
      state: "all",
      page,
      perPage: 100,
    });

    if (ghIssues.length === 0) break;

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const realIssues = ghIssues.filter(
      (i) => !(i as unknown as Record<string, unknown>).pull_request,
    );

    for (const ghIssue of realIssues) {
      const mapped = mapGitHubIssue(ghIssue, owner, repo);
      await upsertIssueFromGitHub(mapped);
      synced++;
    }

    if (ghIssues.length < 100) break;
    page++;
  }

  return synced;
}
