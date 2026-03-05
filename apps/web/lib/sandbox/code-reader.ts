import type { SandboxClient } from "@agent-infra/sandbox";

const DEFAULT_MAX_BYTES = 50_000;
const DEFAULT_MAX_FILES = 20;

// Directories to exclude from file tree
const EXCLUDE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".cache",
  "coverage",
  ".turbo",
  "vendor",
];

async function shellExec(sandbox: SandboxClient, command: string, timeout = 30): Promise<string> {
  const result = await sandbox.shell.execCommand({ command, timeout });
  if (!result.ok) return "";
  return result.body.data?.output ?? "";
}

/**
 * Get file tree of a worktree, excluding common non-source dirs.
 * Returns a string listing all files (suitable for LLM context).
 */
export async function getFileTree(
  sandbox: SandboxClient,
  workDir: string,
): Promise<string> {
  const excludeArgs = EXCLUDE_DIRS.map(
    (d) => `-not -path "*/${d}/*"`,
  ).join(" ");

  return shellExec(
    sandbox,
    `find "${workDir}" -type f ${excludeArgs} | sed "s|^${workDir}/||" | sort | head -500`,
  );
}

/**
 * Read specific files from the sandbox.
 * Truncates each file to maxBytesPerFile.
 * Uses shell cat as a fallback-safe approach.
 */
export async function readFiles(
  sandbox: SandboxClient,
  paths: string[],
  maxBytesPerFile = DEFAULT_MAX_BYTES,
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = [];

  for (const filePath of paths) {
    try {
      // Try file API first
      const result = await sandbox.file.readFile({ file: filePath });
      if (result.ok) {
        let content = result.body.data?.content ?? "";
        if (content.length > maxBytesPerFile) {
          content = content.slice(0, maxBytesPerFile) + "\n... [truncated]";
        }
        results.push({ path: filePath, content });
        continue;
      }
    } catch {
      // file API may not be available, fall back to shell
    }

    // Fallback: use shell cat
    try {
      let content = await shellExec(sandbox, `cat "${filePath}" 2>/dev/null`);
      if (content.length > 0) {
        if (content.length > maxBytesPerFile) {
          content = content.slice(0, maxBytesPerFile) + "\n... [truncated]";
        }
        results.push({ path: filePath, content });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return results;
}

/**
 * Convert flat file list to structured entries.
 */
export async function getFileTreeStructured(
  sandbox: SandboxClient,
  workDir: string,
): Promise<{ path: string; type: "file" }[]> {
  const raw = await getFileTree(sandbox, workDir);
  return raw
    .split("\n")
    .filter(Boolean)
    .map((p) => ({ path: p, type: "file" as const }));
}

/**
 * Read a specific line range from a file.
 */
export async function readFileRange(
  sandbox: SandboxClient,
  filePath: string,
  lineStart: number,
  lineEnd: number,
): Promise<string> {
  return shellExec(sandbox, `sed -n '${lineStart},${lineEnd}p' "${filePath}"`);
}

/**
 * Get per-file diff in a worktree compared to a base branch.
 */
export async function getFileDiff(
  sandbox: SandboxClient,
  worktreePath: string,
  baseBranch: string,
  filePath: string,
): Promise<string> {
  const cmd = `cd "${worktreePath}" && git diff "origin/${baseBranch}"...HEAD -- "${filePath}"`;
  return shellExec(sandbox, cmd);
}

/**
 * Find relevant files by grepping keywords in filenames and content.
 * Returns absolute paths within the worktree.
 */
export async function findRelevantFiles(
  sandbox: SandboxClient,
  workDir: string,
  keywords: string[],
  maxFiles = DEFAULT_MAX_FILES,
): Promise<string[]> {
  if (keywords.length === 0) return [];

  const foundFiles = new Set<string>();

  // Search by filename match
  for (const keyword of keywords) {
    const stdout = await shellExec(
      sandbox,
      `find "${workDir}" -type f -iname "*${keyword}*" ${EXCLUDE_DIRS.map((d) => `-not -path "*/${d}/*"`).join(" ")} | head -10`,
      15,
    );
    const files = stdout.trim().split("\n").filter(Boolean);
    for (const f of files) foundFiles.add(f);
  }

  // Search by content match (grep)
  const pattern = keywords.join("|");
  try {
    const stdout = await shellExec(
      sandbox,
      `grep -rl -E "${pattern}" "${workDir}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.go" --include="*.rs" --include="*.java" --include="*.md" ${EXCLUDE_DIRS.map((d) => `--exclude-dir="${d}"`).join(" ")} 2>/dev/null | head -20`,
      30,
    );
    const files = stdout.trim().split("\n").filter(Boolean);
    for (const f of files) foundFiles.add(f);
  } catch {
    // grep may fail if no matches — that's fine
  }

  // Also include key config files if they exist
  const configFiles = [
    "package.json",
    "tsconfig.json",
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
  ];
  for (const cfg of configFiles) {
    const stdout = await shellExec(
      sandbox,
      `test -f "${workDir}/${cfg}" && echo "${workDir}/${cfg}"`,
      5,
    );
    const f = stdout.trim();
    if (f) foundFiles.add(f);
  }

  return Array.from(foundFiles).slice(0, maxFiles);
}
