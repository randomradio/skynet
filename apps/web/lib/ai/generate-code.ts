import { getAIClient, MODELS } from "./client";
import type { ImplementationPlan, PlannedFile } from "./generate-plan";

export interface GeneratedFile {
  path: string;
  content: string;
  action: "create" | "modify" | "delete";
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
  commitMessage: string;
}

interface CodeGenerationContext {
  issueTitle: string;
  issueBody: string | null;
  plan: ImplementationPlan;
  repoOwner: string;
  repoName: string;
}

const SYSTEM_PROMPT = `You are an expert software engineer generating code based on an implementation plan. Generate the code changes needed to implement the plan.

Your response MUST be valid JSON matching this exact structure:
{
  "files": [
    {
      "path": "relative/file/path.ts",
      "content": "full file content here",
      "action": "create|modify|delete"
    }
  ],
  "commitMessage": "feat(scope): description of the change"
}

Guidelines:
- Generate complete file contents for created files
- For modifications, generate the full updated file content
- For deletions, set content to empty string
- Follow existing code style and conventions
- Include proper TypeScript types
- Follow commit message convention: type(scope): subject
- Return ONLY the JSON, no markdown fences or other text`;

export async function generateCode(
  context: CodeGenerationContext,
): Promise<CodeGenerationResult> {
  const client = getAIClient();

  const fileSummary = context.plan.files
    .map((f: PlannedFile) => `- ${f.action} ${f.path}: ${f.description}`)
    .join("\n");

  const parts = [
    `## Issue: ${context.issueTitle}`,
    `Repository: ${context.repoOwner}/${context.repoName}`,
    context.issueBody ? `Body:\n${context.issueBody}` : "",
    `\n## Implementation Plan`,
    `Summary: ${context.plan.summary}`,
    `Approach: ${context.plan.approach}`,
    `\n## Files to change:`,
    fileSummary,
    context.plan.dependencies.length > 0
      ? `\n## New dependencies: ${context.plan.dependencies.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.chat.completions.create({
    model: MODELS.long,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: parts },
    ],
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  return parseCodeResponse(raw);
}

export function parseCodeResponse(raw: string): CodeGenerationResult {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    text = fenceMatch[1]!.trim();
  }

  try {
    const parsed = JSON.parse(text);
    return {
      files: Array.isArray(parsed.files)
        ? parsed.files.map((f: Record<string, unknown>) => ({
            path: String(f.path ?? ""),
            content: String(f.content ?? ""),
            action: (["create", "modify", "delete"].includes(String(f.action))
              ? f.action
              : "create") as GeneratedFile["action"],
          }))
        : [],
      commitMessage: String(parsed.commitMessage ?? "feat: implement changes"),
    };
  } catch {
    return {
      files: [],
      commitMessage: "feat: implement changes",
    };
  }
}
