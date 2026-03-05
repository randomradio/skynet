import { getAIClient, MODELS } from "./client";

export interface PlannedFile {
  path: string;
  action: "create" | "modify" | "delete";
  description: string;
}

export interface PlannedTest {
  description: string;
  type: "unit" | "integration" | "e2e";
}

export interface ImplementationPlan {
  summary: string;
  approach: string;
  files: PlannedFile[];
  tests: PlannedTest[];
  dependencies: string[];
  risks: string[];
  estimatedComplexity: "low" | "medium" | "high";
}

interface PlanGenerationContext {
  issueTitle: string;
  issueBody: string | null;
  aiSummary: string | null;
  aiType: string | null;
  aiPriority: string | null;
  repoOwner: string;
  repoName: string;
  discussionDocument: string | null;
  fileTree?: string | null;
  relevantFiles?: Array<{ path: string; content: string }>;
}

const SYSTEM_PROMPT = `You are an expert software architect generating implementation plans for GitHub issues. Given an issue and optional discussion context, produce a structured JSON implementation plan.

Your response MUST be valid JSON matching this exact structure:
{
  "summary": "Brief 1-2 sentence summary of what needs to be done",
  "approach": "Detailed description of the implementation approach",
  "files": [
    {
      "path": "relative/file/path.ts",
      "action": "create|modify|delete",
      "description": "What to do with this file"
    }
  ],
  "tests": [
    {
      "description": "What to test",
      "type": "unit|integration|e2e"
    }
  ],
  "dependencies": ["any new packages needed"],
  "risks": ["potential risks or concerns"],
  "estimatedComplexity": "low|medium|high"
}

Guidelines:
- Be specific about file paths and changes
- Include test coverage for new functionality
- Identify dependencies that need to be installed
- Flag risks such as breaking changes or performance concerns
- Return ONLY the JSON, no markdown fences or other text`;

export async function generateImplementationPlan(
  context: PlanGenerationContext,
): Promise<ImplementationPlan> {
  const client = getAIClient();

  const parts = [
    `## Issue`,
    `Title: ${context.issueTitle}`,
    `Repository: ${context.repoOwner}/${context.repoName}`,
  ];

  if (context.issueBody) {
    parts.push(`Body:\n${context.issueBody}`);
  }
  if (context.aiType) {
    parts.push(`AI Classification: ${context.aiType} (${context.aiPriority ?? "unset"})`);
  }
  if (context.aiSummary) {
    parts.push(`AI Summary: ${context.aiSummary}`);
  }
  if (context.discussionDocument) {
    parts.push(`\n## Discussion Document (team decisions)\n${context.discussionDocument}`);
  }
  if (context.fileTree) {
    parts.push(`\n## Repository File Tree\n\`\`\`\n${context.fileTree.slice(0, 5000)}\n\`\`\``);
  }
  if (context.relevantFiles && context.relevantFiles.length > 0) {
    parts.push("\n## Relevant Source Files");
    for (const f of context.relevantFiles) {
      parts.push(`\n### ${f.path}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``);
    }
  }

  const response = await client.chat.completions.create({
    model: MODELS.standard,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: parts.join("\n") },
    ],
    temperature: 0.3,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  return parsePlanResponse(raw);
}

export function parsePlanResponse(raw: string): ImplementationPlan {
  let text = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    text = fenceMatch[1]!.trim();
  }

  try {
    const parsed = JSON.parse(text);
    return {
      summary: String(parsed.summary ?? ""),
      approach: String(parsed.approach ?? ""),
      files: Array.isArray(parsed.files)
        ? parsed.files.map((f: Record<string, unknown>) => ({
            path: String(f.path ?? ""),
            action: (["create", "modify", "delete"].includes(String(f.action))
              ? f.action
              : "modify") as PlannedFile["action"],
            description: String(f.description ?? ""),
          }))
        : [],
      tests: Array.isArray(parsed.tests)
        ? parsed.tests.map((t: Record<string, unknown>) => ({
            description: String(t.description ?? ""),
            type: (["unit", "integration", "e2e"].includes(String(t.type))
              ? t.type
              : "unit") as PlannedTest["type"],
          }))
        : [],
      dependencies: Array.isArray(parsed.dependencies)
        ? parsed.dependencies.map(String)
        : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      estimatedComplexity: (["low", "medium", "high"].includes(
        String(parsed.estimatedComplexity),
      )
        ? parsed.estimatedComplexity
        : "medium") as ImplementationPlan["estimatedComplexity"],
    };
  } catch {
    return {
      summary: "Failed to parse AI-generated plan",
      approach: raw,
      files: [],
      tests: [],
      dependencies: [],
      risks: ["Plan parsing failed — manual review required"],
      estimatedComplexity: "medium",
    };
  }
}
