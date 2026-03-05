import type { SandboxClient } from "@agent-infra/sandbox";

const REPOS_BASE = "/home/gem/repos";
const WORKTREES_BASE = "/home/gem/worktrees";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a command in the sandbox using async+poll to avoid SDK HTTP timeout.
 *
 * The sandbox SDK has a 60s default HTTP timeout on the POST to /v1/shell/exec.
 * Long-running commands (e.g. git fetch on a 200MB repo) exceed this, causing
 * the SDK to return {ok: false} even though the command is still running.
 *
 * This function mirrors the TerminalSession pattern: create a session, run
 * the command in async_mode, then poll shell.view() until completion.
 */
async function exec(
  sandbox: SandboxClient,
  command: string,
  execDir?: string,
  timeoutSec = 120,
): Promise<{ stdout: string; exitCode: number }> {
  const sessionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // 1. Create ephemeral session
    const createResult = await sandbox.shell.createSession({
      id: sessionId,
      exec_dir: execDir || "/home/gem",
    });
    if (!createResult.ok) {
      console.error(`[sandbox/exec] createSession failed for: ${command.slice(0, 80)}`);
      return { stdout: "", exitCode: 1 };
    }

    // 2. Prevent git credential prompts from blocking
    await sandbox.shell.execCommand({
      id: sessionId,
      command: "export GIT_TERMINAL_PROMPT=0",
      timeout: 5,
    });

    // 3. Run command in async mode
    const result = await sandbox.shell.execCommand({
      id: sessionId,
      command,
      async_mode: true,
      timeout: timeoutSec,
    });

    if (!result.ok) {
      console.error(`[sandbox/exec] execCommand failed: ${JSON.stringify(result)}`);
      return { stdout: "", exitCode: 1 };
    }

    // 4. Poll for completion
    const maxWaitMs = timeoutSec * 1000 + 10_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await sleep(1000);
      const view = await sandbox.shell.view({ id: sessionId });
      if (!view.ok) {
        // Transient failure — retry
        continue;
      }
      const data = view.body.data;
      const status = data?.status;

      if (
        status === "completed" ||
        status === "terminated" ||
        status === "hard_timeout"
      ) {
        return {
          stdout: data?.output ?? "",
          exitCode: data?.exit_code ?? (status === "completed" ? 0 : 1),
        };
      }
      // "running" / "no_change_timeout" — keep polling
      // git operations can be silent during network transfers
    }

    console.error(`[sandbox/exec] timed out waiting for: ${command.slice(0, 80)}`);
    return { stdout: "", exitCode: 1 };
  } finally {
    // Best-effort cleanup
    sandbox.shell.cleanupSession(sessionId).catch(() => {});
  }
}

/**
 * Clone repo into sandbox: /home/gem/repos/{owner}/{name}
 * Uses GITHUB_TOKEN for auth. Shallow clone for speed.
 * If already cloned, returns existing path.
 */
export async function ensureRepoCloned(
  sandbox: SandboxClient,
  owner: string,
  name: string,
  token: string,
): Promise<string> {
  const repoPath = `${REPOS_BASE}/${owner}/${name}`;

  // Check if already cloned
  const check = await exec(sandbox, `test -d "${repoPath}/.git" && echo exists`);
  if (check.stdout.trim() === "exists") {
    return repoPath;
  }

  // Create parent directory
  await exec(sandbox, `mkdir -p "${REPOS_BASE}/${owner}"`);

  // Shallow clone with token auth
  const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${name}.git`;
  const result = await exec(
    sandbox,
    `git clone --depth 50 "${cloneUrl}" "${repoPath}" 2>&1`,
    undefined,
    180,
  );

  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone ${owner}/${name}: ${result.stdout}`);
  }

  return repoPath;
}

/**
 * Fetch latest refs from remote.
 * Uses --depth 50 to match the shallow clone, avoiding full fetch on large repos.
 */
export async function fetchLatest(
  sandbox: SandboxClient,
  repoPath: string,
): Promise<void> {
  const result = await exec(sandbox, "git fetch origin --depth 50 2>&1", repoPath, 120);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch: ${result.stdout}`);
  }
}

/**
 * Create a git worktree for an agent run.
 * - develop mode: new branch from default branch
 * - review mode: checkout existing PR head branch
 */
export async function createWorktree(
  sandbox: SandboxClient,
  options: {
    repoPath: string;
    runId: string;
    mode: "develop" | "review";
    baseBranch: string;
    checkoutBranch?: string; // for review mode
  },
): Promise<string> {
  const worktreePath = `${WORKTREES_BASE}/${options.runId}`;
  await exec(sandbox, `mkdir -p "${WORKTREES_BASE}"`);

  let result;
  if (options.mode === "review" && options.checkoutBranch) {
    // Review mode: checkout the PR's head branch
    result = await exec(
      sandbox,
      `git worktree add "${worktreePath}" "origin/${options.checkoutBranch}" 2>&1`,
      options.repoPath,
      60,
    );
  } else {
    // Develop mode: create new branch from base
    const branchName = `agent/${options.runId.slice(0, 8)}`;
    result = await exec(
      sandbox,
      `git worktree add -b "${branchName}" "${worktreePath}" "origin/${options.baseBranch}" 2>&1`,
      options.repoPath,
      60,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create worktree: ${result.stdout}`);
  }

  return worktreePath;
}

/**
 * Clean up a worktree after an agent run.
 */
export async function cleanupWorktree(
  sandbox: SandboxClient,
  repoPath: string,
  worktreePath: string,
): Promise<void> {
  await exec(sandbox, `rm -rf "${worktreePath}"`);
  await exec(sandbox, "git worktree prune", repoPath);
}

/**
 * Get diff stats in worktree (for review mode).
 */
export async function getDiffStats(
  sandbox: SandboxClient,
  worktreePath: string,
  baseBranch: string,
): Promise<string> {
  const result = await exec(
    sandbox,
    `git diff "origin/${baseBranch}"...HEAD --stat && echo "---FULL_DIFF---" && git diff "origin/${baseBranch}"...HEAD`,
    worktreePath,
    30,
  );
  return result.stdout;
}
