import { getAIClient, MODELS } from "./client";

export interface AnalysisInput {
  title: string;
  body: string | null;
  labels: string[];
}

export interface AnalysisResult {
  aiType: "bug" | "feature" | "task" | "question";
  aiPriority: "P0" | "P1" | "P2" | "P3";
  aiSummary: string;
  aiTags: string[];
  aiAnalysis: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are a software issue classifier. Analyze the GitHub issue and return a JSON object with exactly these fields:
- "aiType": one of "bug", "feature", "task", "question"
- "aiPriority": one of "P0" (critical), "P1" (high), "P2" (medium), "P3" (low)
- "aiSummary": a concise 1-2 sentence summary
- "aiTags": an array of relevant tags (e.g. ["frontend", "auth", "performance"])
- "aiAnalysis": an object with keys "rootCause", "suggestedApproach", "affectedAreas", "estimatedComplexity"

Return ONLY valid JSON, no markdown fencing.`;

export function parseAnalysisResponse(raw: string): AnalysisResult {
  let text = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1]!.trim();
  }

  const parsed = JSON.parse(text);

  const validTypes = ["bug", "feature", "task", "question"];
  const validPriorities = ["P0", "P1", "P2", "P3"];

  return {
    aiType: validTypes.includes(parsed.aiType) ? parsed.aiType : "task",
    aiPriority: validPriorities.includes(parsed.aiPriority) ? parsed.aiPriority : "P2",
    aiSummary: typeof parsed.aiSummary === "string" ? parsed.aiSummary.slice(0, 500) : "No summary available",
    aiTags: Array.isArray(parsed.aiTags) ? parsed.aiTags.filter((t: unknown) => typeof t === "string") : [],
    aiAnalysis: typeof parsed.aiAnalysis === "object" && parsed.aiAnalysis !== null ? parsed.aiAnalysis : {},
  };
}

export async function analyzeIssue(input: AnalysisInput): Promise<AnalysisResult> {
  const client = getAIClient();

  const userMessage = [
    `Title: ${input.title}`,
    input.body ? `Body:\n${input.body}` : "Body: (empty)",
    input.labels.length > 0 ? `Labels: ${input.labels.join(", ")}` : "Labels: (none)",
  ].join("\n\n");

  const response = await client.chat.completions.create({
    model: MODELS.standard,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from AI");
  }

  return parseAnalysisResponse(content);
}
