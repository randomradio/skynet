import type { SandboxClient } from "@agent-infra/sandbox";

async function exec(
  sandbox: SandboxClient,
  command: string,
  timeout = 30,
): Promise<{ stdout: string; exitCode: number }> {
  const result = await sandbox.shell.execCommand({ command, timeout });
  if (!result.ok) return { stdout: "", exitCode: 1 };
  const data = result.body.data;
  return { stdout: data?.output ?? "", exitCode: data?.exit_code ?? 1 };
}

function buildAuthedRemoteUrl(remote: string, token: string): string {
  let normalized = remote.trim();
  if (normalized.startsWith("git@github.com:")) {
    normalized = `https://github.com/${normalized.slice("git@github.com:".length)}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Unsupported git remote URL: ${remote}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Unsupported git remote URL: ${remote}`);
  }
  parsed.username = "";
  parsed.password = "";

  return `https://x-access-token:${encodeURIComponent(token)}@${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * Write content to a file in the sandbox worktree.
 * Uses a quoted heredoc (single-quoted delimiter) so shell doesn't expand variables.
 * If content itself contains the delimiter, fall back to base64.
 */
export async function writeFile(
  sandbox: SandboxClient,
  filePath: string,
  content: string,
): Promise<void> {
  // Ensure parent directory exists
  const dir = filePath.replace(/\/[^/]+$/, "");
  await exec(sandbox, `mkdir -p "${dir}"`);

  if (content.includes("SKYNET_EOF")) {
    // Fallback: base64 encode to avoid heredoc delimiter collision
    const b64 = Buffer.from(content).toString("base64");
    const cmd = `echo '${b64}' | base64 -d > "${filePath}"`;
    const result = await exec(sandbox, cmd);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to write file ${filePath}`);
    }
  } else {
    const cmd = `cat > "${filePath}" << 'SKYNET_EOF'\n${content}\nSKYNET_EOF`;
    const result = await exec(sandbox, cmd);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to write file ${filePath}`);
    }
  }
}

/**
 * Apply a fix by replacing lines lineStart-lineEnd with new content.
 */
export async function applyFix(
  sandbox: SandboxClient,
  filePath: string,
  lineStart: number,
  lineEnd: number,
  newContent: string,
): Promise<void> {
  // Delete existing lines and insert new content using sed
  // Use a temp file approach for reliability
  const tmpFile = `/tmp/skynet_fix_${Date.now()}`;
  await writeFile(sandbox, tmpFile, newContent);
  const cmd = `sed -i '${lineStart},${lineEnd}d' "${filePath}" && sed -i '${lineStart - 1}r ${tmpFile}' "${filePath}" && rm -f "${tmpFile}"`;
  const result = await exec(sandbox, cmd);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to apply fix at ${filePath}:${lineStart}-${lineEnd}`);
  }
}

/**
 * Get full working-tree diff (unstaged changes).
 */
export async function getWorkingDiff(
  sandbox: SandboxClient,
  worktreePath: string,
): Promise<string> {
  const result = await exec(sandbox, `cd "${worktreePath}" && git diff`);
  return result.stdout;
}

/**
 * Get per-file working diff.
 */
export async function getWorkingFileDiff(
  sandbox: SandboxClient,
  worktreePath: string,
  filePath: string,
): Promise<string> {
  const result = await exec(sandbox, `cd "${worktreePath}" && git diff -- "${filePath}"`);
  return result.stdout;
}

/**
 * Discard all uncommitted changes in the worktree.
 * Handles staged files, modified tracked files, and untracked files.
 */
export async function discardChanges(
  sandbox: SandboxClient,
  worktreePath: string,
): Promise<void> {
  await exec(
    sandbox,
    `cd "${worktreePath}" && git reset HEAD -- . && git checkout -- . && git clean -fd`,
  );
}

/**
 * Commit and push changes from the worktree.
 */
export async function commitAndPush(
  sandbox: SandboxClient,
  worktreePath: string,
  message: string,
  token: string,
): Promise<{ sha: string }> {
  // Set git identity for the commit
  await exec(sandbox, `cd "${worktreePath}" && git config user.email "skynet@ai.dev" && git config user.name "Skynet AI"`);

  // Stage all and commit
  const commitResult = await exec(
    sandbox,
    `cd "${worktreePath}" && git add -A && git commit -m "${message.replace(/"/g, '\\"')}" 2>&1`,
  );
  if (commitResult.exitCode !== 0) {
    throw new Error(`Commit failed: ${commitResult.stdout}`);
  }

  // Set remote URL with token and push.
  const remoteResult = await exec(sandbox, `cd "${worktreePath}" && git remote get-url origin`);
  const currentRemote = remoteResult.stdout.trim();
  const authedRemote = buildAuthedRemoteUrl(currentRemote, token);

  await exec(sandbox, `cd "${worktreePath}" && git remote set-url origin "${authedRemote}" 2>&1`);
  const pushResult = await exec(sandbox, `cd "${worktreePath}" && git push -u origin HEAD 2>&1`, 60);
  await exec(sandbox, `cd "${worktreePath}" && git remote set-url origin "${currentRemote}" 2>&1`);
  if (pushResult.exitCode !== 0) {
    throw new Error(`Push failed: ${pushResult.stdout}`);
  }

  // Get commit SHA
  const shaResult = await exec(sandbox, `cd "${worktreePath}" && git rev-parse HEAD`);
  return { sha: shaResult.stdout.trim() };
}

/**
 * Push current HEAD branch without creating a new commit.
 * Useful when the coding tool already committed changes.
 */
export async function pushCurrentBranch(
  sandbox: SandboxClient,
  worktreePath: string,
  token: string,
): Promise<void> {
  const remoteResult = await exec(sandbox, `cd "${worktreePath}" && git remote get-url origin`);
  const currentRemote = remoteResult.stdout.trim();
  const authedRemote = buildAuthedRemoteUrl(currentRemote, token);

  await exec(sandbox, `cd "${worktreePath}" && git remote set-url origin "${authedRemote}" 2>&1`);
  const pushResult = await exec(sandbox, `cd "${worktreePath}" && git push -u origin HEAD 2>&1`, 60);
  await exec(sandbox, `cd "${worktreePath}" && git remote set-url origin "${currentRemote}" 2>&1`);
  if (pushResult.exitCode !== 0) {
    throw new Error(`Push failed: ${pushResult.stdout}`);
  }
}
