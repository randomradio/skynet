import { getAIClient, MODELS } from "./client";

interface SynthesisMessage {
  role: "user" | "ai";
  content: string;
}

interface SynthesisContext {
  issueTitle: string;
  issueBody: string | null;
}

const SYSTEM_PROMPT = `You are a document synthesizer for the Skynet development platform. Your job is to create and update a structured living document from team discussion messages about a GitHub issue.

The document should use this structure:
## Overview
Brief summary of what's being discussed.

## Requirements
- Bullet list of agreed requirements

## Approach
The proposed implementation approach.

## Technical Design
Key technical decisions and architecture notes.

## Open Questions
- Unresolved questions from the discussion

## Decisions
- Key decisions made during discussion

Update the document based on new messages. Preserve existing content and refine based on new information. Return ONLY the markdown document, no preamble.`;

export async function synthesizeDocument(
  messages: SynthesisMessage[],
  currentDoc: string | null,
  issueContext: SynthesisContext,
): Promise<string> {
  const client = getAIClient();

  const userContent = [
    `## Issue\nTitle: ${issueContext.issueTitle}`,
    issueContext.issueBody ? `Body:\n${issueContext.issueBody}` : "",
    currentDoc ? `## Current Document\n${currentDoc}` : "",
    `## Discussion Messages`,
    ...messages.map(
      (m) => `[${m.role === "ai" ? "AI" : "User"}] ${m.content}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: MODELS.standard,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? currentDoc ?? "";
}
