import type { ReviewFinding } from "@/lib/types/code-review";
import {
  getSandbox,
  readFileRange,
  applyFix,
  getWorkingDiff,
} from "@/lib/sandbox";

export interface AppliedFix {
  findingId: string;
  file: string;
  status: "applied" | "failed";
  error?: string;
}

/**
 * Apply AI-generated fixes to a sandbox worktree.
 * Does NOT commit — only modifies files. Returns the git diff.
 */
export async function applyFixesToWorktree(
  agentRunId: string,
  findings: ReviewFinding[],
  worktreePath: string,
  baseBranch: string,
): Promise<{ appliedFixes: AppliedFix[]; diff: string }> {
  const sandbox = getSandbox();
  const { getAIClient, MODELS } = await import("@/lib/ai/client");
  const client = getAIClient();

  const appliedFixes: AppliedFix[] = [];

  // Process findings in reverse line order per file to avoid line offset issues
  const byFile = new Map<string, ReviewFinding[]>();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(f);
  }

  for (const [file, fileFindings] of byFile) {
    // Sort by lineStart descending so we apply bottom-up
    const sorted = [...fileFindings].sort((a, b) => b.lineStart - a.lineStart);

    for (const finding of sorted) {
      try {
        const filePath = `${worktreePath}/${finding.file}`;

        // Read context: the lines around the finding
        const contextStart = Math.max(1, finding.lineStart - 10);
        const contextEnd = finding.lineEnd + 10;
        const context = await readFileRange(sandbox, filePath, contextStart, contextEnd);

        // Read the exact lines to fix
        const originalCode = await readFileRange(sandbox, filePath, finding.lineStart, finding.lineEnd);

        // Ask AI to generate the fix
        const response = await client.chat.completions.create({
          model: MODELS.standard,
          messages: [
            {
              role: "system",
              content: `You are a code fixer. You will be given a code finding and the surrounding context. Generate ONLY the replacement code for lines ${finding.lineStart}-${finding.lineEnd}. Do not include any explanation, markdown, or code fences. Output ONLY the replacement code.`,
            },
            {
              role: "user",
              content: `File: ${finding.file}\nFinding (${finding.severity}): ${finding.message}\nCategory: ${finding.category}\n\nContext (lines ${contextStart}-${contextEnd}):\n${context}\n\nOriginal code to fix (lines ${finding.lineStart}-${finding.lineEnd}):\n${originalCode}\n\nGenerate the fixed replacement code:`,
            },
          ],
          temperature: 0.2,
        });

        const fixedCode = response.choices[0]?.message?.content ?? "";
        if (!fixedCode.trim()) {
          appliedFixes.push({ findingId: finding.id, file: finding.file, status: "failed", error: "Empty fix" });
          continue;
        }

        // Apply the fix to the worktree file
        await applyFix(sandbox, filePath, finding.lineStart, finding.lineEnd, fixedCode);

        appliedFixes.push({ findingId: finding.id, file: finding.file, status: "applied" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        appliedFixes.push({ findingId: finding.id, file: finding.file, status: "failed", error: msg });
      }
    }
  }

  // Get the full diff of all changes
  const diff = await getWorkingDiff(sandbox, worktreePath);

  return { appliedFixes, diff };
}
