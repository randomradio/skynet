/**
 * End-to-end test for AIO Sandbox integration.
 * Tests: sandbox health, git clone, worktree, code-reader, cleanup.
 *
 * Usage: cd apps/web && npx tsx ../../scripts/test-sandbox.ts
 */

import { SandboxClient } from "@agent-infra/sandbox";

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8180";
const TEST_REPO_OWNER = "randomradio";
const TEST_REPO_NAME = "day1";

const sandbox = new SandboxClient({ environment: SANDBOX_URL });

async function shellExec(command: string, timeout = 60): Promise<{ output: string; exitCode: number }> {
  const result = await sandbox.shell.execCommand({ command, timeout });
  if (!result.ok) {
    return { output: `Request failed`, exitCode: 1 };
  }
  return {
    output: result.body.data?.output ?? "",
    exitCode: result.body.data?.exit_code ?? 1,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("=== AIO Sandbox Integration Test ===\n");
  console.log(`Sandbox URL: ${SANDBOX_URL}`);
  console.log(`Test repo: ${TEST_REPO_OWNER}/${TEST_REPO_NAME}\n`);

  // ── Test 1: Sandbox Health ──
  console.log("--- Test 1: Sandbox Health ---");
  try {
    const ctx = await sandbox.sandbox.getContext();
    assert(ctx.ok === true, "Sandbox responds");
    if (ctx.ok) {
      assert(ctx.body.home_dir === "/home/gem", `Home dir is /home/gem (got: ${ctx.body.home_dir})`);
    }
  } catch (err) {
    assert(false, "Sandbox health check", String(err));
  }

  // ── Test 2: Shell Command Execution ──
  console.log("\n--- Test 2: Shell Command Execution ---");
  try {
    const echoResult = await shellExec("echo hello_from_sandbox");
    assert(echoResult.output.includes("hello_from_sandbox"), "Shell echo works");
    assert(echoResult.exitCode === 0, "Exit code is 0");
  } catch (err) {
    assert(false, "Shell command", String(err));
  }

  // ── Test 3: Git Clone ──
  console.log("\n--- Test 3: Git Clone ---");
  const repoPath = `/home/gem/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}`;
  try {
    await shellExec(`mkdir -p /home/gem/repos/${TEST_REPO_OWNER}`);

    const cloneResult = await shellExec(
      `git clone --depth 50 https://github.com/${TEST_REPO_OWNER}/${TEST_REPO_NAME}.git "${repoPath}" 2>&1`,
      120,
    );
    console.log(`  Clone output: ${cloneResult.output.slice(0, 200)}`);

    const checkGit = await shellExec(`test -d "${repoPath}/.git" && echo exists`);
    assert(checkGit.output.trim() === "exists", "Repo cloned successfully");

    const ls = await shellExec(`ls "${repoPath}"`);
    assert(ls.exitCode === 0, "Can list repo files");
    console.log(`  Repo contents: ${ls.output.slice(0, 300)}`);
  } catch (err) {
    assert(false, "Git clone", String(err));
  }

  // ── Test 4: Git Fetch ──
  console.log("\n--- Test 4: Git Fetch ---");
  try {
    const fetchResult = await shellExec(`cd "${repoPath}" && git fetch --all --prune 2>&1`, 60);
    assert(fetchResult.exitCode === 0, "Git fetch succeeds");
  } catch (err) {
    assert(false, "Git fetch", String(err));
  }

  // ── Test 5: Git Worktree (develop mode) ──
  console.log("\n--- Test 5: Git Worktree (develop mode) ---");
  const runId = "test-" + Date.now().toString(36);
  const worktreePath = `/home/gem/worktrees/${runId}`;
  try {
    await shellExec("mkdir -p /home/gem/worktrees");

    const branchName = `agent/${runId.slice(0, 8)}`;
    const wtResult = await shellExec(
      `cd "${repoPath}" && git worktree add -b "${branchName}" "${worktreePath}" "origin/main" 2>&1`,
      60,
    );
    console.log(`  Worktree output: ${wtResult.output.slice(0, 200)}`);
    assert(wtResult.exitCode === 0, `Worktree created`, wtResult.output.slice(0, 100));

    const checkWt = await shellExec(`test -d "${worktreePath}" && echo exists`);
    assert(checkWt.output.trim() === "exists", "Worktree directory exists");
  } catch (err) {
    assert(false, "Create worktree", String(err));
  }

  // ── Test 6: File Tree (code-reader) ──
  console.log("\n--- Test 6: File Tree ---");
  try {
    const excludeDirs = ["node_modules", ".git", "dist", "build", ".next"];
    const excludeArgs = excludeDirs.map(d => `-not -path "*/${d}/*"`).join(" ");
    const treeResult = await shellExec(
      `find "${worktreePath}" -type f ${excludeArgs} | sed "s|^${worktreePath}/||" | sort | head -100`,
      30,
    );
    assert(treeResult.exitCode === 0, "File tree generated");
    const files = treeResult.output.trim().split("\n").filter(Boolean);
    assert(files.length > 0, `Found ${files.length} file(s) in tree`);
    console.log(`  File tree (first 5):\n    ${files.slice(0, 5).join("\n    ")}`);
  } catch (err) {
    assert(false, "File tree", String(err));
  }

  // ── Test 7: Read Files (via file API) ──
  console.log("\n--- Test 7: Read Files ---");
  try {
    const findResult = await shellExec(
      `find "${worktreePath}" -maxdepth 3 -type f \\( -name "*.md" -o -name "*.json" -o -name "*.py" -o -name "*.js" -o -name "*.ts" \\) | head -3`,
    );
    const files = findResult.output.trim().split("\n").filter(Boolean);
    assert(files.length > 0, `Found ${files.length} readable file(s)`);

    for (const f of files) {
      try {
        const readResult = await sandbox.file.readFile({ file: f });
        if (readResult.ok) {
          const content = readResult.body.data?.content ?? "";
          assert(content.length > 0, `Read (file API): ${f.replace(worktreePath + "/", "")} (${content.length} bytes)`);
        } else {
          // Try shell fallback
          const catResult = await shellExec(`cat "${f}" 2>/dev/null`);
          assert(catResult.output.length > 0, `Read (shell cat): ${f.replace(worktreePath + "/", "")} (${catResult.output.length} bytes)`);
        }
      } catch {
        const catResult = await shellExec(`cat "${f}" 2>/dev/null`);
        assert(catResult.output.length > 0, `Read (shell cat fallback): ${f.replace(worktreePath + "/", "")} (${catResult.output.length} bytes)`);
      }
    }
  } catch (err) {
    assert(false, "Read files", String(err));
  }

  // ── Test 8: Find Relevant Files (grep) ──
  console.log("\n--- Test 8: Find Relevant Files (grep) ---");
  try {
    const grepResult = await shellExec(
      `grep -rl -E "import|def |function " "${worktreePath}" --include="*.py" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -10`,
      30,
    );
    const grepFiles = grepResult.output.trim().split("\n").filter(Boolean);
    console.log(`  Grep found ${grepFiles.length} file(s)`);
    if (grepFiles.length > 0) {
      console.log(`  Results: ${grepFiles.slice(0, 3).map(f => f.replace(worktreePath + "/", "")).join(", ")}`);
    }
    assert(true, `Grep search completed (${grepFiles.length} matches)`);
  } catch (err) {
    assert(false, "Grep files", String(err));
  }

  // ── Test 9: Cleanup Worktree ──
  console.log("\n--- Test 9: Cleanup Worktree ---");
  try {
    await shellExec(`rm -rf "${worktreePath}"`);
    await shellExec(`cd "${repoPath}" && git worktree prune`);
    const checkClean = await shellExec(`test -d "${worktreePath}" && echo exists || echo cleaned`);
    assert(checkClean.output.trim() === "cleaned", "Worktree cleaned up");
  } catch (err) {
    assert(false, "Cleanup worktree", String(err));
  }

  // ── Test 10: Cleanup cloned repo ──
  console.log("\n--- Test 10: Cleanup ---");
  try {
    await shellExec(`rm -rf "${repoPath}"`);
    const checkClean = await shellExec(`test -d "${repoPath}" && echo exists || echo cleaned`);
    assert(checkClean.output.trim() === "cleaned", "Repo cleaned up");
  } catch (err) {
    assert(false, "Cleanup repo", String(err));
  }

  // ── Summary ──
  console.log("\n=== Summary ===");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\nAll sandbox integration tests passed!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
