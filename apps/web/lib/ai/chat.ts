import { getAIClient, MODELS } from "./client";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  authorId?: string | null;
}

interface ChatContext {
  messages: ChatMessage[];
  synthesizedDocument: string | null;
  issueTitle: string;
  issueBody: string | null;
}

const SYSTEM_PROMPT = `You are an AI development workflow participant in the Skynet platform. You help cross-functional teams (PMs, engineers, designers) discuss and plan GitHub issue implementations.

Your responsibilities:
- Provide technical analysis and suggestions
- Ask clarifying questions when requirements are unclear
- Suggest implementation approaches with trade-offs
- Help identify edge cases and potential issues
- Reference the living document when relevant

Keep responses focused and actionable. Use markdown for code snippets and structure.`;

function buildMessages(context: ChatContext) {
  const systemParts = [SYSTEM_PROMPT];

  systemParts.push(`\n## Current Issue\nTitle: ${context.issueTitle}`);
  if (context.issueBody) {
    systemParts.push(`Body:\n${context.issueBody}`);
  }

  if (context.synthesizedDocument) {
    systemParts.push(`\n## Current Living Document\n${context.synthesizedDocument}`);
  }

  const chatMessages = context.messages.map((m) => ({
    role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
    content: m.content,
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
