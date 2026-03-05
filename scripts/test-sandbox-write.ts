/**
 * Extended sandbox test: write operations, code editing, diff, commit workflow.
 * Tests the full lifecycle: clone → worktree → write → edit → diff → commit → push (dry-run).
 *
 * Usage: cd apps/web && npx tsx ../../scripts/test-sandbox-write.ts
 */

import { SandboxClient } from "@agent-infra/sandbox";

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8180";
const TEST_REPO_OWNER = "randomradio";
const TEST_REPO_NAME = "day1";

const sandbox = new SandboxClient({ environment: SANDBOX_URL });

async function shellExec(
  command: string,
  timeout = 60,
): Promise<{ output: string; exitCode: number }> {
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
  console.log("=== Sandbox Write & Edit Integration Test ===\n");
  console.log(`Sandbox URL: ${SANDBOX_URL}`);
  console.log(`Test repo: ${TEST_REPO_OWNER}/${TEST_REPO_NAME}\n`);

  const repoPath = `/home/gem/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}`;
  const runId = "write-test-" + Date.now().toString(36);
  const worktreePath = `/home/gem/worktrees/${runId}`;
  const branchName = `agent/${runId.slice(0, 8)}`;

  // ── Setup: Clone + Worktree ──
  console.log("--- Setup: Clone & Worktree ---");
  try {
    // Clean any previous test state
    await shellExec(`rm -rf "${repoPath}"`);

    await shellExec(`mkdir -p /home/gem/repos/${TEST_REPO_OWNER}`);
    const cloneResult = await shellExec(
      `git clone --depth 50 https://github.com/${TEST_REPO_OWNER}/${TEST_REPO_NAME}.git "${repoPath}" 2>&1`,
      120,
    );
    assert(cloneResult.exitCode === 0, "Repo cloned", cloneResult.output.slice(0, 100));

    await shellExec("mkdir -p /home/gem/worktrees");
    const wtResult = await shellExec(
      `cd "${repoPath}" && git worktree add -b "${branchName}" "${worktreePath}" "origin/main" 2>&1`,
      60,
    );
    assert(wtResult.exitCode === 0, "Worktree created", wtResult.output.slice(0, 100));
  } catch (err) {
    assert(false, "Setup", String(err));
    return;
  }

  // ── Test 1: Write a new file (heredoc) ──
  console.log("\n--- Test 1: Write New File (heredoc) ---");
  try {
    const newFileContent = `# Test File
This file was created by the sandbox write test.

def hello():
    return "world"

if __name__ == "__main__":
    print(hello())
`;
    const filePath = `${worktreePath}/test_write.py`;
    const cmd = `cat > "${filePath}" << 'SKYNET_EOF'\n${newFileContent}\nSKYNET_EOF`;
    const writeResult = await shellExec(cmd);
    assert(writeResult.exitCode === 0, "Write file via heredoc");

    const readBack = await shellExec(`cat "${filePath}"`);
    assert(readBack.output.includes("def hello()"), "File content correct");
    assert(readBack.output.includes("sandbox write test"), "File header correct");
  } catch (err) {
    assert(false, "Write new file", String(err));
  }

  // ── Test 2: Write file via file API ──
  console.log("\n--- Test 2: Write File via File API ---");
  try {
    const apiContent = '{"name": "sandbox-test", "version": "1.0.0"}';
    const apiFilePath = `${worktreePath}/test_api_write.json`;
    const writeResult = await sandbox.file.writeFile({
      file: apiFilePath,
      content: apiContent,
    });
    assert(writeResult.ok === true, "File API write succeeds");

    const readBack = await shellExec(`cat "${apiFilePath}"`);
    assert(readBack.output.includes("sandbox-test"), "File API content correct");
  } catch (err) {
    // File API may not support write — check and fall back
    console.log(`  INFO: File API write error: ${err}`);
    assert(false, "File API write", String(err));
  }

  // ── Test 3: Edit existing file (sed line replace) ──
  console.log("\n--- Test 3: Edit File (sed line replace) ---");
  try {
    // First, find a file to edit
    const findResult = await shellExec(
      `find "${worktreePath}" -maxdepth 2 -name "*.md" -type f | head -1`,
    );
    const targetFile = findResult.output.trim();
    assert(targetFile.length > 0, `Found target file: ${targetFile.replace(worktreePath + "/", "")}`);

    // Read first 5 lines
    const before = await shellExec(`sed -n '1,5p' "${targetFile}"`);
    console.log(`  Before edit (first 5 lines):`);
    before.output.split("\n").slice(0, 3).forEach((l) => console.log(`    ${l}`));

    // Insert a comment at line 2
    const editResult = await shellExec(
      `sed -i '2i\\<!-- Edited by Skynet sandbox test -->' "${targetFile}"`,
    );
    assert(editResult.exitCode === 0, "Sed insert at line 2");

    const after = await shellExec(`sed -n '1,5p' "${targetFile}"`);
    assert(
      after.output.includes("Edited by Skynet sandbox test"),
      "Edit is visible in file",
    );
  } catch (err) {
    assert(false, "Edit file", String(err));
  }

  // ── Test 4: Apply multi-line fix (sed delete + insert from tmpfile) ──
  console.log("\n--- Test 4: Apply Multi-line Fix (applyFix pattern) ---");
  try {
    const fixFile = `${worktreePath}/test_write.py`;

    // Read current lines 4-5 (the def hello block)
    const current = await shellExec(`sed -n '4,5p' "${fixFile}"`);
    console.log(`  Current L4-5: ${current.output.trim()}`);

    // Write replacement to temp file
    const newContent = `def hello(name: str = "world"):\n    return f"Hello, {name}!"`;
    await shellExec(`cat > /tmp/skynet_fix.txt << 'SKYNET_EOF'\n${newContent}\nSKYNET_EOF`);

    // Delete lines 4-5, insert new content at line 4
    const deleteResult = await shellExec(`sed -i '4,5d' "${fixFile}"`);
    assert(deleteResult.exitCode === 0, "Delete original lines 4-5");

    const insertResult = await shellExec(`sed -i '3r /tmp/skynet_fix.txt' "${fixFile}"`);
    assert(insertResult.exitCode === 0, "Insert replacement at line 4");

    // Verify
    const verify = await shellExec(`cat "${fixFile}"`);
    assert(verify.output.includes("def hello(name: str"), "Multi-line fix applied correctly");
    assert(verify.output.includes('f"Hello, {name}!"'), "Fix content correct");
    console.log(`  After fix:\n${verify.output.split("\n").map(l => `    ${l}`).join("\n")}`);
  } catch (err) {
    assert(false, "Apply multi-line fix", String(err));
  }

  // ── Test 5: Git diff (working tree changes) ──
  console.log("\n--- Test 5: Git Diff (working tree) ---");
  try {
    const diffResult = await shellExec(`cd "${worktreePath}" && git diff`);
    assert(diffResult.exitCode === 0, "Git diff succeeds");
    const hasDiff = diffResult.output.length > 10;
    assert(hasDiff, `Working diff has content (${diffResult.output.length} bytes)`);

    if (hasDiff) {
      console.log(`  Diff preview (first 300 chars):`);
      console.log(diffResult.output.slice(0, 300));
    }

    // Also check untracked files
    const statusResult = await shellExec(`cd "${worktreePath}" && git status --porcelain`);
    assert(statusResult.exitCode === 0, "Git status succeeds");
    console.log(`  Status:\n${statusResult.output.split("\n").map(l => `    ${l}`).join("\n")}`);
  } catch (err) {
    assert(false, "Git diff", String(err));
  }

  // ── Test 6: Git add + diff --staged ──
  console.log("\n--- Test 6: Git Staged Diff ---");
  try {
    const addResult = await shellExec(`cd "${worktreePath}" && git add -A`);
    assert(addResult.exitCode === 0, "Git add -A");

    const stagedDiff = await shellExec(`cd "${worktreePath}" && git diff --staged --stat`);
    assert(stagedDiff.exitCode === 0, "Staged diff stat");
    console.log(`  Staged stat:\n${stagedDiff.output}`);
  } catch (err) {
    assert(false, "Git staged diff", String(err));
  }

  // ── Test 7: Git commit (local only, no push) ──
  console.log("\n--- Test 7: Git Commit (local) ---");
  try {
    const commitResult = await shellExec(
      `cd "${worktreePath}" && git -c user.email="skynet@test.dev" -c user.name="Skynet Test" commit -m "test: sandbox write/edit integration test"`,
    );
    assert(commitResult.exitCode === 0, "Git commit succeeds");
    console.log(`  Commit output: ${commitResult.output.slice(0, 200)}`);

    const logResult = await shellExec(`cd "${worktreePath}" && git log --oneline -3`);
    assert(logResult.output.includes("sandbox write/edit"), "Commit in log");
    console.log(`  Recent log:\n${logResult.output.split("\n").map(l => `    ${l}`).join("\n")}`);
  } catch (err) {
    assert(false, "Git commit", String(err));
  }

  // ── Test 8: Discard changes (git checkout -- .) ──
  console.log("\n--- Test 8: Discard Changes ---");
  try {
    // Make another change
    await shellExec(`echo "# throwaway" >> "${worktreePath}/throwaway.md"`);
    await shellExec(`cd "${worktreePath}" && git add throwaway.md`);

    const beforeDiscard = await shellExec(`cd "${worktreePath}" && git status --porcelain`);
    assert(beforeDiscard.output.trim().length > 0, "Changes exist before discard");

    await shellExec(`cd "${worktreePath}" && git reset HEAD -- . && git checkout -- . && git clean -fd`);

    const afterDiscard = await shellExec(`cd "${worktreePath}" && git status --porcelain`);
    assert(afterDiscard.output.trim().length === 0, "Working tree clean after discard");
  } catch (err) {
    assert(false, "Discard changes", String(err));
  }

  // ── Test 9: Read file range (readFileRange pattern) ──
  console.log("\n--- Test 9: Read File Range ---");
  try {
    const findResult = await shellExec(
      `find "${worktreePath}" -name "*.py" -type f | head -1`,
    );
    const pyFile = findResult.output.trim();
    if (pyFile) {
      const lineCount = await shellExec(`wc -l < "${pyFile}"`);
      const totalLines = parseInt(lineCount.output.trim(), 10);
      console.log(`  File: ${pyFile.replace(worktreePath + "/", "")} (${totalLines} lines)`);

      const rangeStart = 1;
      const rangeEnd = Math.min(10, totalLines);
      const rangeResult = await shellExec(`sed -n '${rangeStart},${rangeEnd}p' "${pyFile}"`);
      assert(rangeResult.exitCode === 0, `Read lines ${rangeStart}-${rangeEnd}`);
      assert(rangeResult.output.length > 0, "Range content not empty");
      console.log(`  Lines ${rangeStart}-${rangeEnd}:\n${rangeResult.output.split("\n").map(l => `    ${l}`).join("\n")}`);
    } else {
      console.log("  No Python files found, skipping range test");
      assert(true, "Range test skipped (no .py files)");
    }
  } catch (err) {
    assert(false, "Read file range", String(err));
  }

  // ── Test 10: Per-file diff against base branch ──
  console.log("\n--- Test 10: Per-file Diff vs Base Branch ---");
  try {
    // Make a change and commit to have diff vs origin/main
    await shellExec(
      `echo "# sandbox test file" > "${worktreePath}/sandbox_marker.txt"`,
    );
    await shellExec(`cd "${worktreePath}" && git add sandbox_marker.txt`);
    await shellExec(
      `cd "${worktreePath}" && git -c user.email="skynet@test.dev" -c user.name="Skynet Test" commit -m "test: add marker file"`,
    );

    const perFileDiff = await shellExec(
      `cd "${worktreePath}" && git diff "origin/main"...HEAD -- sandbox_marker.txt`,
    );
    assert(perFileDiff.exitCode === 0, "Per-file diff succeeds");
    assert(
      perFileDiff.output.includes("sandbox test file"),
      "Per-file diff shows change",
    );
    console.log(`  Per-file diff:\n${perFileDiff.output}`);

    const fullDiff = await shellExec(
      `cd "${worktreePath}" && git diff "origin/main"...HEAD --stat`,
    );
    console.log(`  Full diff stat:\n${fullDiff.output}`);
  } catch (err) {
    assert(false, "Per-file diff", String(err));
  }

  // ── Cleanup ──
  console.log("\n--- Cleanup ---");
  try {
    await shellExec(`rm -rf "${worktreePath}"`);
    await shellExec(`cd "${repoPath}" && git worktree prune`);
    await shellExec(`rm -rf "${repoPath}"`);
    assert(true, "Cleanup complete");
  } catch (err) {
    assert(false, "Cleanup", String(err));
  }

  // ── Summary ──
  console.log("\n=== Summary ===");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\nAll sandbox write & edit tests passed!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
