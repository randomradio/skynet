import { hasAIConfig } from "./client";
import { generateAIChatResponse, type ChatContext } from "./chat";
import { synthesizeDocument } from "./synthesize";
import { loadOrgContext } from "@/lib/config/org-context";
import {
  getOrCreateDiscussion,
  getDiscussionByIssueId,
  listMessages,
  insertMessage,
  updateSynthesizedDocument,
  getIssueById,
  listPullRequestsByIssueNumber,
} from "@skynet/db";
import type { IssueDetail } from "@skynet/db";

/**
 * Trigger a non-streaming AI response for a discussion.
 * Used for auto-triggered scenarios (@mention, PR events, etc.)
 * where we don't need to stream to the client.
 */
export async function triggerAIResponse(
  issueId: string,
  parentId?: string,
): Promise<string | null> {
  if (!hasAIConfig()) return null;

  const discussion = await getOrCreateDiscussion(issueId);
  if (discussion.finalized) return null;

  const issueResult = await getIssueById(issueId);
  const issue = issueResult.issue;
  if (!issue) return null;

  const context = await buildFullContext(discussion, issue);

  const content = await generateAIChatResponse(context);
  if (!content) return null;

  const messageId = await insertMessage({
    discussionId: discussion.id,
    authorId: null,
    authorType: "ai",
    content,
    parentId,
  });

  // Auto-synthesize if enough messages
  maybeSynthesize(discussion, issue).catch(() => {});

  return messageId;
}

/**
 * Build the full ChatContext for an issue's discussion.
 * Shared between streaming and non-streaming AI responses.
 */
async function buildFullContext(
  discussion: { id: string; synthesizedDocument: string | null },
  issue: IssueDetail,
): Promise<ChatContext> {
  const msgs = await listMessages(discussion.id, { limit: 50 });

  const chatMessages = msgs.map((m) => ({
    role: m.authorType as "user" | "ai" | "system",
    content: m.content,
    authorId: m.authorId,
  }));

  const orgContext = loadOrgContext();
  const issueLabels = Array.isArray(issue.labels)
    ? (issue.labels as string[])
    : [];

  const issueAIAnalysis = {
    aiType: issue.aiType,
    aiPriority: issue.aiPriority,
    aiSummary: issue.aiSummary,
    aiTags: Array.isArray(issue.aiTags)
      ? (issue.aiTags as string[])
      : undefined,
    aiAnalysis:
      issue.aiAnalysis && typeof issue.aiAnalysis === "object"
        ? (issue.aiAnalysis as Record<string, unknown>)
        : undefined,
  };

  let relatedPRs: ChatContext["relatedPRs"];
  try {
    const prs = await listPullRequestsByIssueNumber(
      issue.repoOwner,
      issue.repoName,
      issue.number,
    );
    if (prs.length > 0) {
      relatedPRs = prs.map((pr) => ({
        number: pr.number,
        title: typeof pr.title === "string" ? pr.title : "",
        state: pr.state,
        headBranch: pr.headBranch,
      }));
    }
  } catch {
    // PR table may not exist yet
  }

  return {
    messages: chatMessages,
    synthesizedDocument: discussion.synthesizedDocument,
    issueTitle: issue.title,
    issueBody: issue.body,
    issueLabels,
    issueAIAnalysis,
    orgContext: orgContext || undefined,
    relatedPRs,
  };
}

async function maybeSynthesize(
  discussion: {
    id: string;
    synthesizedDocument: string | null;
    lastSynthesizedAt: Date | null;
  },
  issue: IssueDetail,
): Promise<void> {
  const recentMsgs = await listMessages(discussion.id, { limit: 50 });
  const sinceLastSynthesis = discussion.lastSynthesizedAt
    ? recentMsgs.filter((m) => m.createdAt > discussion.lastSynthesizedAt!).length
    : recentMsgs.length;

  if (sinceLastSynthesis >= 3) {
    const issueLabels = Array.isArray(issue.labels)
      ? (issue.labels as string[])
      : [];
    const orgContext = loadOrgContext();

    const doc = await synthesizeDocument(
      recentMsgs.map((m) => ({
        role: m.authorType as "user" | "ai" | "system",
        content: m.content,
      })),
      discussion.synthesizedDocument,
      {
        issueTitle: issue.title,
        issueBody: issue.body,
        issueLabels,
        aiSummary: issue.aiSummary,
        orgContext: orgContext || undefined,
      },
    );
    await updateSynthesizedDocument(discussion.id, doc);
  }
}
