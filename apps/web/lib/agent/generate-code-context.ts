import type { CodeContextSnippet } from "@/lib/types/code-review";
import {
  getSandbox,
  isSandboxAvailable,
  ensureRepoCloned,
  fetchLatest,
  findRelevantFiles,
  readFiles,
} from "@/lib/sandbox";
import { upsertCodeContext, getCodeContext } from "@skynet/db";

interface Issue {
  id: string;
  title: string;
  body: string | null;
  repoOwner: string;
  repoName: string;
}

function extractKeywords(title: string, body: string | null): string[] {
  const text = `${title} ${body ?? ""}`;
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "about",
    "that", "this", "it", "not", "but", "or", "and", "if", "when", "which",
    "what", "how", "add", "fix", "update", "change", "implement", "create",
    "remove", "delete", "new", "old", "bug", "feature", "issue", "error",
  ]);

  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9_-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w)),
  )].slice(0, 8);
}

/**
 * Generate code context snippets relevant to an issue.
 * Uses sandbox to find and read relevant files, then asks AI to select snippets.
 */
export async function generateIssueCodeContext(
  issue: Issue,
): Promise<CodeContextSnippet[]> {
  const sandboxAvailable = await isSandboxAvailable();
  const token = process.env.GITHUB_TOKEN;

  if (!sandboxAvailable || !token) {
    return [];
  }

  try {
    const sandbox = getSandbox();
    const repoPath = await ensureRepoCloned(sandbox, issue.repoOwner, issue.repoName, token);
    await fetchLatest(sandbox, repoPath);

    const keywords = extractKeywords(issue.title, issue.body);
    const relevantPaths = await findRelevantFiles(sandbox, repoPath, keywords);
    const fileContents = await readFiles(sandbox, relevantPaths);

    if (fileContents.length === 0) return [];

    // Ask AI to select the most relevant snippets
    const { getAIClient, MODELS } = await import("@/lib/ai/client");
    const client = getAIClient();

    const filesContext = fileContents
      .map((f) => {
        const relPath = f.path.replace(repoPath + "/", "");
        return `### ${relPath}\n\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\``;
      })
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: MODELS.standard,
      messages: [
        {
          role: "system",
          content: `You are a code analyst. Given an issue and code files, select the most relevant code snippets.

Return valid JSON array:
[
  {
    "file": "relative/path.ts",
    "lineStart": 10,
    "lineEnd": 25,
    "content": "the relevant code snippet",
    "language": "typescript",
    "relevanceReason": "Brief explanation of why this code is relevant"
  }
]

Select 3-5 most relevant snippets. Each snippet should be 5-30 lines.`,
        },
        {
          role: "user",
          content: `Issue: ${issue.title}\n\n${issue.body ?? ""}\n\n## Files\n${filesContext}`,
        },
      ],
      temperature: 0.2,
    });

    const text = response.choices[0]?.message?.content ?? "[]";
    const jsonText = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    let snippets: CodeContextSnippet[];
    try {
      const parsed = JSON.parse(jsonText);
      snippets = (Array.isArray(parsed) ? parsed : []).map((s: Record<string, unknown>) => ({
        file: String(s.file ?? ""),
        lineStart: Number(s.lineStart ?? 0),
        lineEnd: Number(s.lineEnd ?? 0),
        content: String(s.content ?? ""),
        language: String(s.language ?? "text"),
        relevanceReason: String(s.relevanceReason ?? ""),
      }));
    } catch {
      snippets = [];
    }

    // Cache in database
    await upsertCodeContext({
      issueId: issue.id,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
      snippets,
    });

    return snippets;
  } catch {
    return [];
  }
}

/**
 * Get cached code context for an issue, or empty array.
 */
export async function getCachedCodeContext(
  issueId: string,
): Promise<CodeContextSnippet[]> {
  try {
    const ctx = await getCodeContext(issueId);
    if (!ctx?.snippets) return [];
    return Array.isArray(ctx.snippets) ? (ctx.snippets as CodeContextSnippet[]) : [];
  } catch {
    return [];
  }
}
