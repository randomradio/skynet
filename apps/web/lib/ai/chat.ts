import { getAIClient, MODELS } from "./client";

export interface ChatMessage {
  role: "user" | "ai" | "system";
  content: string;
  authorId?: string | null;
}

export interface ChatContext {
  messages: ChatMessage[];
  synthesizedDocument: string | null;
  issueTitle: string;
  issueBody: string | null;
  issueLabels?: string[];
  issueAIAnalysis?: {
    aiType?: string | null;
    aiPriority?: string | null;
    aiSummary?: string | null;
    aiTags?: string[];
    aiAnalysis?: Record<string, unknown> | null;
  };
  orgContext?: string;
  relatedPRs?: Array<{
    number: number;
    title: string;
    state: string;
    headBranch: string;
  }>;
}

const SYSTEM_PROMPT = `You are an AI development workflow participant in the Skynet platform. You help cross-functional teams (PMs, engineers, designers) discuss and plan GitHub issue implementations.

Your responsibilities:
- Provide technical analysis and suggestions grounded in the project's actual context
- Ask clarifying questions when requirements are unclear
- Suggest implementation approaches with trade-offs
- Help identify edge cases and potential issues
- Reference the living document, AI analysis, and related PRs when relevant
- When answering about priorities, types, or analysis, cite the AI analysis data provided

Keep responses focused and actionable. Use markdown for code snippets and structure.`;

function buildMessages(context: ChatContext) {
  const systemParts = [SYSTEM_PROMPT];

  // Organization context (project standards, architecture)
  if (context.orgContext) {
    systemParts.push(`\n## Organization Context\n${context.orgContext}`);
  }

  // Current issue details
  systemParts.push(`\n## Current Issue\nTitle: ${context.issueTitle}`);
  if (context.issueBody) {
    systemParts.push(`Body:\n${context.issueBody}`);
  }
  if (context.issueLabels && context.issueLabels.length > 0) {
    systemParts.push(`Labels: ${context.issueLabels.join(", ")}`);
  }

  // AI analysis results
  if (context.issueAIAnalysis) {
    const a = context.issueAIAnalysis;
    const analysisParts: string[] = [];
    if (a.aiType) analysisParts.push(`Type: ${a.aiType}`);
    if (a.aiPriority) analysisParts.push(`Priority: ${a.aiPriority}`);
    if (a.aiSummary) analysisParts.push(`Summary: ${a.aiSummary}`);
    if (a.aiTags && a.aiTags.length > 0) {
      analysisParts.push(`Tags: ${a.aiTags.join(", ")}`);
    }
    if (a.aiAnalysis && typeof a.aiAnalysis === "object") {
      const details = a.aiAnalysis as Record<string, unknown>;
      if (details.rootCause) analysisParts.push(`Root Cause: ${details.rootCause}`);
      if (details.suggestedApproach) analysisParts.push(`Suggested Approach: ${details.suggestedApproach}`);
      if (details.affectedAreas) analysisParts.push(`Affected Areas: ${JSON.stringify(details.affectedAreas)}`);
      if (details.estimatedComplexity) analysisParts.push(`Estimated Complexity: ${details.estimatedComplexity}`);
    }
    if (analysisParts.length > 0) {
      systemParts.push(`\n## AI Analysis\n${analysisParts.join("\n")}`);
    }
  }

  // Related pull requests
  if (context.relatedPRs && context.relatedPRs.length > 0) {
    const prLines = context.relatedPRs.map(
      (pr) => `- PR #${pr.number}: "${pr.title}" (${pr.state}, branch: ${pr.headBranch})`,
    );
    systemParts.push(`\n## Related Pull Requests\n${prLines.join("\n")}`);
  }

  // Living document
  if (context.synthesizedDocument) {
    systemParts.push(`\n## Current Living Document\n${context.synthesizedDocument}`);
  }

  const chatMessages = context.messages.map((m) => ({
    role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
    content:
      m.role === "system"
        ? `[System notification] ${m.content}`
        : m.content,
  }));

  return {
    system: systemParts.join("\n"),
    messages: chatMessages,
  };
}

export async function* streamAIChatResponse(
  context: ChatContext,
): AsyncIterable<string> {
  const client = getAIClient();
  const { system, messages } = buildMessages(context);

  const stream = await client.chat.completions.create({
    model: MODELS.long,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * Non-streaming AI chat response. Used for auto-triggered responses
 * where we don't need to stream to the client.
 */
export async function generateAIChatResponse(
  context: ChatContext,
): Promise<string> {
  const client = getAIClient();
  const { system, messages } = buildMessages(context);

  const response = await client.chat.completions.create({
    model: MODELS.long,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? "";
}
