import crypto from "node:crypto";
import {
  getIssueById,
  updateAgentRunStatus,
  appendAgentRunLog,
  appendTerminalOutput,
  completeAgentRun,
  getWorkspaceByIssueId,
  getWorkspaceById,
  createWorkspace,
  activateWorkspace,
  pauseWorkspace,
  type AgentLog,
  type AgentArtifact,
  type WorkspaceRow,
} from "@skynet/db";
import {
  getSandbox,
  isSandboxAvailable,
  ensureRepoCloned,
  fetchLatest,
  createWorktree,
  getWorkingDiff,
  commitAndPush,
  pushCurrentBranch,
  runSandboxCommand,
} from "@/lib/sandbox";
import { resolveRepositoryDefaultBranch } from "@/lib/repositories/default-branch";
import { getGitHubClient } from "@/lib/github/client";
import { TerminalSession } from "./terminal-session";
import type { AgentProgressCallback } from "./engine";

const PREFIX = "[InteractiveEngine]";

async function log(
  runId: string,
  level: AgentLog["level"],
  message: string,
  metadata?: Record<string, unknown>,
  onProgress?: AgentProgressCallback,
): Promise<void> {
  const entry: AgentLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };
  console.log(`${PREFIX} [${runId.slice(0, 8)}] ${level}: ${message}`);
  await appendAgentRunLog(runId, entry);
  onProgress?.(entry);
}

export async function executeInteractiveAgent(
  runId: string,
  issueId: string,
  options?: { autoCreatePR?: boolean; runTests?: boolean; tool?: string },
  onProgress?: AgentProgressCallback,
  onSessionReady?: (session: TerminalSession) => void,
): Promise<{ session: TerminalSession }> {
  const session = new TerminalSession(runId);
  let workspace: WorkspaceRow | null = null;

  console.log(`${PREFIX} [${runId.slice(0, 8)}] executeInteractiveAgent issueId=${issueId} tool=${options?.tool ?? "opencode"}`);

  try {
    // 1. Load issue
    const issueResult = await getIssueById(issueId);
    const issue = issueResult.issue;
    if (!issue) throw new Error("Issue not found");

    await log(runId, "info", `Starting interactive agent for: ${issue.title}`, {
      issueId,
      repoOwner: issue.repoOwner,
      repoName: issue.repoName,
    }, onProgress);
    const baseBranch = await resolveRepositoryDefaultBranch(issue.repoOwner, issue.repoName);

    // 2. Check sandbox
    const sandboxAvailable = await isSandboxAvailable();
    console.log(`${PREFIX} [${runId.slice(0, 8)}] sandboxAvailable=${sandboxAvailable}`);
    if (!sandboxAvailable) {
      throw new Error("Sandbox is not available — interactive mode requires a running sandbox");
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required for interactive mode");
    }

    const sandbox = getSandbox();

    // 3. Check for existing workspace
    workspace = await getWorkspaceByIssueId(issueId);

    let worktreePath = "";
    let repoPath = "";
    let resumed = false;

    if (workspace && (workspace.status === "paused" || workspace.status === "active")) {
      // Attempt to resume an existing workspace — verify worktree still exists.
      try {
        if (!workspace.worktreePath || !workspace.repoPath) {
          workspace = null;
        } else {
          const checkResult = await sandbox.shell.execCommand({
            command: `test -d "${workspace.worktreePath}/.git" && echo yes`,
            timeout: 10,
          });
          const alive = checkResult.ok && checkResult.body.data?.output?.trim() === "yes";

          if (alive) {
            worktreePath = workspace.worktreePath;
            repoPath = workspace.repoPath;
            try {
              await fetchLatest(sandbox, repoPath);
            } catch (err) {
              await log(
                runId,
                "warn",
                "Workspace fetch failed while resuming; continuing with existing refs",
                { error: err instanceof Error ? err.message : String(err) },
                onProgress,
              );
            }
            await activateWorkspace(workspace.id, runId, workspace.assignedTo ?? workspace.createdBy);

            await appendTerminalOutput(
              runId,
              `\n--- Session ${workspace.sessionCount + 1} started (resumed) ---\n`,
            );
            await log(
              runId,
              "info",
              `Resumed workspace (session #${workspace.sessionCount + 1}, status=${workspace.status})`,
              { workspaceId: workspace.id },
              onProgress,
            );
            resumed = true;
          } else {
            // Worktree gone (sandbox restarted) — fall through to create new
            console.log(`${PREFIX} [${runId.slice(0, 8)}] workspace worktree gone, recreating...`);
            workspace = null;
          }
        }
      } catch {
        console.log(`${PREFIX} [${runId.slice(0, 8)}] workspace check failed, recreating...`);
        workspace = null;
      }
    } else if (workspace) {
      // completed/expired workspaces should not be resumed.
      workspace = null;
    }

    if (!workspace) {
      // Create new workspace
      console.log(`${PREFIX} [${runId.slice(0, 8)}] cloning repo ${issue.repoOwner}/${issue.repoName}...`);
      repoPath = await ensureRepoCloned(sandbox, issue.repoOwner, issue.repoName, token);
      try {
        await fetchLatest(sandbox, repoPath);
      } catch (err) {
        await log(
          runId,
          "warn",
          "Fetch latest failed after clone; continuing with existing local refs",
          { error: err instanceof Error ? err.message : String(err) },
          onProgress,
        );
      }
      await log(runId, "info", "Repository ready in sandbox", { repoPath }, onProgress);

      console.log(`${PREFIX} [${runId.slice(0, 8)}] creating worktree...`);
      worktreePath = await createWorktree(sandbox, {
        repoPath,
        runId,
        mode: "develop",
        baseBranch,
      });
      await log(
        runId,
        "info",
        `Worktree created: ${worktreePath}`,
        { baseBranch },
        onProgress,
      );

      const branchName = `agent/${runId.slice(0, 8)}`;
      const wsId = crypto.randomUUID();
      await createWorkspace({
        id: wsId,
        issueId,
        repoPath,
        worktreePath,
        branch: branchName,
        createdBy: "system",
      });
      await activateWorkspace(wsId, runId, "system");
      workspace = await getWorkspaceById(wsId);
    }

    // 4. Build env vars
    const env: Record<string, string> = {};
    env.PATH = `/usr/local/bin:/usr/bin:/bin:/root/.opencode/bin:/home/gem/.opencode/bin:${process.env.PATH || ""}`;
    const anthropicToken = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY;
    if (anthropicToken) {
      env.ANTHROPIC_AUTH_TOKEN = anthropicToken;
      env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? anthropicToken;
      env.ANTHROPIC_BASE_URL =
        process.env.ANTHROPIC_BASE_URL ?? "https://open.bigmodel.cn/api/anthropic";
      env.ANTHROPIC_DEFAULT_SONNET_MODEL =
        process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "glm-4.7";
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL =
        process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? "glm-4.5-air";
      env.ANTHROPIC_DEFAULT_OPUS_MODEL =
        process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "glm-4.7";
      env.ZHIPU_API_KEY = process.env.ZHIPU_API_KEY ?? anthropicToken;
    }
    if (process.env.ZHIPU_API_KEY) {
      env.ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
    }
    if (process.env.AI_API_KEY) {
      env.AI_API_KEY = process.env.AI_API_KEY;
    }
    if (token) {
      env.GITHUB_TOKEN = token;
    }
    console.log(`${PREFIX} [${runId.slice(0, 8)}] env keys: ${Object.keys(env).join(", ")}`);

    // 5. Build command
    const tool = options?.tool ?? "opencode";
    const taskDescription = buildTaskDescription(issue);
    let command = `${tool} run ${JSON.stringify(taskDescription)}`;

    if (tool === "opencode") {
      // Prevent stale runs from previous timed-out sessions from accumulating.
      await runSandboxCommand(sandbox, "pkill -f 'opencode run' || true", { timeoutSec: 10 });

      const selectedModel = await resolveOpencodeModel(sandbox, worktreePath, env);
      command = `opencode run -m ${shellQuote(selectedModel.model)} --format json ${JSON.stringify(taskDescription)}`;
      await log(
        runId,
        "info",
        `Using opencode model: ${selectedModel.model}`,
        selectedModel.reason ? { reason: selectedModel.reason } : undefined,
        onProgress,
      );
    }

    await updateAgentRunStatus(runId, "coding");
    await log(runId, "info", `Running: ${tool}${resumed ? " (resumed session)" : ""}`, { command }, onProgress);

    // 6. Expose session so callers can send input while running
    onSessionReady?.(session);
    console.log(`${PREFIX} [${runId.slice(0, 8)}] session ready callback fired, starting terminal...`);

    // 7. Start terminal session (blocks until process exits)
    const startTime = Date.now();
    const { exitCode } = await session.start(command, worktreePath, env);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    await log(
      runId,
      exitCode === 0 ? "info" : "warn",
      `Process exited with code ${exitCode} after ${duration}s`,
      { exitCode, durationSec: Number(duration) },
      onProgress,
    );

    // 8. Collect results
    const artifacts: AgentArtifact[] = [];
    let hasWorkingTreeDiff = false;
    try {
      const diff = await getWorkingDiff(sandbox, worktreePath);
      if (diff.trim()) {
        artifacts.push({ type: "diff", content: diff });
        hasWorkingTreeDiff = true;
        console.log(`${PREFIX} [${runId.slice(0, 8)}] collected diff: ${diff.length} chars`);
      }
    } catch (err) {
      console.log(`${PREFIX} [${runId.slice(0, 8)}] no diff: ${err instanceof Error ? err.message : err}`);
    }

    // 9. Run validations and persist a test report artifact.
    let validationsPassed = true;
    if (exitCode === 0 && options?.runTests !== false) {
      await updateAgentRunStatus(runId, "testing");
      const commands = await resolveValidationCommands(sandbox, worktreePath);
      if (commands.length === 0) {
        const report = [
          "# Validation Report",
          "",
          "No validation commands detected for this repository.",
        ].join("\n");
        artifacts.push({ type: "test_report", path: "validation-report.txt", content: report });
        await log(runId, "warn", "Validation skipped — no commands detected", undefined, onProgress);
      } else {
        await log(runId, "info", `Running ${commands.length} validation command(s)...`, { commands }, onProgress);
        const validation = await runValidationCommands(sandbox, worktreePath, commands);
        artifacts.push({
          type: "test_report",
          path: "validation-report.txt",
          content: validation.report,
        });
        validationsPassed = validation.passed;
        await log(
          runId,
          validation.passed ? "info" : "warn",
          validation.passed ? "All validation commands passed" : "Validation failed",
          {
            commandsRun: validation.commandsRun,
            failedCommand: validation.failedCommand,
          },
          onProgress,
        );
      }
    } else if (exitCode === 0) {
      await log(runId, "info", "Validation skipped by run option", undefined, onProgress);
    } else {
      await log(runId, "warn", "Validation skipped because the coding process failed", undefined, onProgress);
    }

    // 10. Push branch + create draft PR when configured.
    let branch: string | undefined;
    let prNumber: number | undefined;
    const hasUnpushedCommits = await detectUnpushedCommits(sandbox, worktreePath);
    const canPublish = exitCode === 0 && validationsPassed && (hasWorkingTreeDiff || hasUnpushedCommits);

    if (options?.autoCreatePR && canPublish) {
      try {
        if (hasWorkingTreeDiff) {
          const commitMsg = `feat: implement changes for issue (interactive agent)`;
          await commitAndPush(sandbox, worktreePath, commitMsg, token);
        } else {
          await pushCurrentBranch(sandbox, worktreePath, token);
        }

        const branchResult = await runSandboxCommand(sandbox, "git rev-parse --abbrev-ref HEAD", {
          execDir: worktreePath,
          timeoutSec: 10,
        });
        branch = branchResult.stdout.trim() || undefined;
        await log(runId, "info", `Changes pushed to branch: ${branch}`, undefined, onProgress);

        if (branch) {
          const github = getGitHubClient();
          const pr = await github.createPullRequest(issue.repoOwner, issue.repoName, {
            title: `fix: ${issue.title}`,
            body: [
              `Closes #${issue.number}`,
              "",
              "## Summary",
              issue.aiSummary ?? issue.body ?? "",
              "",
              "_Generated by Skynet interactive agent_",
            ].join("\n"),
            head: branch,
            base: baseBranch,
            draft: true,
          });
          prNumber = pr.number;
          await log(
            runId,
            "info",
            `Draft PR created: #${pr.number}`,
            { prUrl: pr.html_url },
            onProgress,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Push failed";
        await log(runId, "warn", `Auto-PR failed: ${msg}`, undefined, onProgress);
      }
    } else if (options?.autoCreatePR && !canPublish) {
      await log(
        runId,
        "warn",
        "Skipping auto PR because coding/validation did not produce a publishable result",
        { exitCode, validationsPassed, hasWorkingTreeDiff, hasUnpushedCommits },
        onProgress,
      );
    }

    // 11. Pause workspace (preserve worktree for resume) instead of cleaning up
    if (workspace) {
      await pauseWorkspace(workspace.id, 24);
      await log(runId, "info", "Workspace paused — worktree preserved for resume", undefined, onProgress);
    }

    const finalStatus = exitCode === 0 && validationsPassed ? "completed" : "failed";
    await completeAgentRun(runId, {
      status: finalStatus,
      branch,
      prNumber,
      artifacts,
    });

    await log(runId, "info", `Interactive agent finished — ${finalStatus}`, {
      exitCode,
      artifactCount: artifacts.length,
      branch,
    }, onProgress);

    return { session };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`${PREFIX} [${runId.slice(0, 8)}] FATAL: ${message}`);
    await log(runId, "error", `Interactive agent failed: ${message}`, undefined, onProgress);

    // On error: still pause workspace if it exists (preserve worktree)
    if (workspace) {
      await pauseWorkspace(workspace.id, 24).catch(() => {});
    }

    try {
      await completeAgentRun(runId, { status: "failed" });
    } catch {
      // best-effort
    }

    return { session };
  }
  // NOTE: No finally block that deletes the worktree — workspace persists
}

function buildTaskDescription(issue: {
  title: string;
  body: string | null;
  aiSummary?: string | null;
}): string {
  const parts = [`Implement: ${issue.title}`];
  if (issue.body) {
    parts.push("", issue.body);
  }
  if (issue.aiSummary) {
    parts.push("", `AI Summary: ${issue.aiSummary}`);
  }
  parts.push(
    "",
    "Execution constraints:",
    "- Modify repository files only.",
    "- Do NOT create commits, branches, tags, or push to remote.",
    "- Do NOT run git commit / git push / git checkout -b.",
    "- Leave changes unstaged or staged; the Skynet runtime handles commit/push/PR.",
  );
  return parts.join("\n");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function buildExportPrefix(env: Record<string, string>): string {
  const entries = Object.entries(env);
  if (entries.length === 0) return "";
  return entries
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join(" && ");
}

function derivePreferredGlmModel(): string {
  const fromEnv =
    process.env.OPENCODE_GLM_MODEL ??
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ??
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
  const model = fromEnv?.trim();
  return model && model.length > 0 ? model : "glm-4.5-air";
}

async function resolveOpencodeModel(
  sandbox: ReturnType<typeof getSandbox>,
  worktreePath: string,
  env: Record<string, string>,
): Promise<{ model: string; reason?: string }> {
  const explicit = process.env.OPENCODE_MODEL?.trim();
  if (explicit) {
    return { model: explicit, reason: "selected from OPENCODE_MODEL" };
  }

  const glmModel = derivePreferredGlmModel();
  const candidates: string[] = [];
  if (env.ZHIPU_API_KEY) {
    candidates.push(`zhipuai/${glmModel}`);
    candidates.push(`zai/${glmModel}`);
  }
  candidates.push("opencode/gpt-5-nano");

  const exportPrefix = buildExportPrefix(env);
  const failures: Array<{ model: string; exitCode: number; sample: string }> = [];
  for (const candidate of candidates) {
    const command = [
      `cd "${worktreePath}"`,
      exportPrefix,
      `opencode run -m ${shellQuote(candidate)} --format json ${shellQuote("reply with just OK")}`,
    ]
      .filter(Boolean)
      .join(" && ");

    const result = await runSandboxCommand(sandbox, command, {
      timeoutSec: 45,
      useProxy: true,
    });
    const looksHealthy =
      result.exitCode === 0 &&
      (result.stdout.includes("\"type\":\"text\"") ||
        result.stdout.includes("\"reason\":\"stop\""));

    if (looksHealthy) {
      return { model: candidate };
    }

    failures.push({
      model: candidate,
      exitCode: result.exitCode,
      sample: result.stdout.slice(0, 180),
    });
  }

  return {
    model: "opencode/gpt-5-nano",
    reason: `fallback after health-check failures: ${JSON.stringify(failures).slice(0, 500)}`,
  };
}

async function detectUnpushedCommits(
  sandbox: ReturnType<typeof getSandbox>,
  worktreePath: string,
): Promise<boolean> {
  const result = await runSandboxCommand(
    sandbox,
    `cd "${worktreePath}" && git rev-list --count HEAD --not --remotes 2>/dev/null || echo 0`,
    { timeoutSec: 10 },
  );
  if (result.exitCode !== 0) return false;

  const value = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(value) && value > 0;
}

function parseValidationCommands(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|;;/)
    .map((command) => command.trim())
    .filter((command) => command.length > 0);
}

async function pathExists(
  sandbox: ReturnType<typeof getSandbox>,
  worktreePath: string,
  relativePath: string,
): Promise<boolean> {
  const result = await runSandboxCommand(
    sandbox,
    `test -e "${worktreePath}/${relativePath}" && echo yes`,
    { timeoutSec: 10 },
  );
  return result.exitCode === 0 && result.stdout.trim() === "yes";
}

async function resolveValidationCommands(
  sandbox: ReturnType<typeof getSandbox>,
  worktreePath: string,
): Promise<string[]> {
  const fromEnv = parseValidationCommands(
    process.env.AGENT_VALIDATION_COMMANDS ?? process.env.AGENT_TEST_COMMANDS,
  );
  if (fromEnv.length > 0) return fromEnv;

  const hasWorkspaceFile = await pathExists(sandbox, worktreePath, "pnpm-workspace.yaml");
  const hasWebApp = await pathExists(sandbox, worktreePath, "apps/web/package.json");
  if (hasWorkspaceFile && hasWebApp) {
    return [
      "pnpm typecheck",
      "pnpm test",
      "pnpm --filter @skynet/web lint",
      "pnpm --filter @skynet/web build",
    ];
  }

  const hasPnpmLock = await pathExists(sandbox, worktreePath, "pnpm-lock.yaml");
  const hasPackageJson = await pathExists(sandbox, worktreePath, "package.json");
  if (hasPnpmLock && hasPackageJson) {
    return ["pnpm test --if-present"];
  }
  if (hasPackageJson) {
    return ["npm test --if-present"];
  }

  return [];
}

async function ensureValidationDependencies(
  sandbox: ReturnType<typeof getSandbox>,
  worktreePath: string,
  commands: string[],
  pnpmAvailable: boolean,
): Promise<{ command: string; output: string; exitCode: number; durationSec: string } | null> {
  const needsPnpm = commands.some((command) => /^pnpm(\s|$)/.test(command));
  const needsNpm = commands.some((command) => /^npm(\s|$)/.test(command));
  if (!needsPnpm && !needsNpm) return null;

  const hasNodeModules = await pathExists(sandbox, worktreePath, "node_modules");
  if (hasNodeModules) return null;

  let installCommand = "";
  if (needsPnpm) {
    installCommand = pnpmAvailable ? "pnpm install --frozen-lockfile" : "corepack pnpm install --frozen-lockfile";
  } else if (needsNpm) {
    installCommand = "npm install";
  }
  if (!installCommand) return null;

  const startedAt = Date.now();
  let result = await runSandboxCommand(
    sandbox,
    `cd "${worktreePath}" && ${installCommand} 2>&1`,
    { timeoutSec: 1800, useProxy: true },
  );
  if (result.exitCode !== 0 && installCommand.includes("--frozen-lockfile")) {
    installCommand = installCommand.replace(" --frozen-lockfile", "");
    result = await runSandboxCommand(
      sandbox,
      `cd "${worktreePath}" && ${installCommand} 2>&1`,
      { timeoutSec: 1800, useProxy: true },
    );
  }

  return {
    command: installCommand,
    output: result.stdout,
    exitCode: result.exitCode,
    durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
  };
}

async function runValidationCommands(
  sandbox: ReturnType<typeof getSandbox>,
  worktreePath: string,
  commands: string[],
): Promise<{ passed: boolean; report: string; commandsRun: number; failedCommand?: string }> {
  const reportLines: string[] = [
    "# Validation Report",
    `Generated at: ${new Date().toISOString()}`,
    "",
  ];

  let passed = true;
  let commandsRun = 0;
  let failedCommand: string | undefined;
  const usesPnpm = commands.some((command) => /^pnpm(\s|$)/.test(command));
  if (usesPnpm) {
    await runSandboxCommand(
      sandbox,
      `cd "${worktreePath}" && (corepack enable pnpm >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || true)`,
      { timeoutSec: 20 },
    );
  }
  const pnpmCheck = await runSandboxCommand(
    sandbox,
    `cd "${worktreePath}" && command -v pnpm >/dev/null 2>&1 && echo yes || echo no`,
    { timeoutSec: 10 },
  );
  const pnpmAvailable = pnpmCheck.exitCode === 0 && pnpmCheck.stdout.trim().endsWith("yes");
  const installReport = await ensureValidationDependencies(
    sandbox,
    worktreePath,
    commands,
    pnpmAvailable,
  );
  if (installReport) {
    commandsRun += 1;
    reportLines.push("## Command 1");
    reportLines.push(`$ ${installReport.command}`);
    reportLines.push("");
    reportLines.push("```text");
    reportLines.push(installReport.output || "(no output)");
    reportLines.push("```");
    reportLines.push(`exit_code=${installReport.exitCode} duration_sec=${installReport.durationSec}`);
    reportLines.push("");
    if (installReport.exitCode !== 0) {
      return {
        passed: false,
        report: reportLines.join("\n"),
        commandsRun,
        failedCommand: installReport.command,
      };
    }
  }

  for (const command of commands) {
    const effectiveCommand =
      !pnpmAvailable && /^pnpm(\s|$)/.test(command)
        ? command.replace(/^pnpm\b/, "corepack pnpm")
        : command;

    commandsRun += 1;
    const startedAt = Date.now();
    const result = await runSandboxCommand(
      sandbox,
      `cd "${worktreePath}" && ${effectiveCommand} 2>&1`,
      { timeoutSec: 1800, useProxy: true },
    );
    const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);

    reportLines.push(`## Command ${commandsRun}`);
    reportLines.push(`$ ${command}`);
    if (effectiveCommand !== command) {
      reportLines.push(`effective: ${effectiveCommand}`);
    }
    reportLines.push("");
    reportLines.push("```text");
    reportLines.push(result.stdout || "(no output)");
    reportLines.push("```");
    reportLines.push(`exit_code=${result.exitCode} duration_sec=${durationSec}`);
    reportLines.push("");

    if (result.exitCode !== 0) {
      passed = false;
      failedCommand = command;
      break;
    }
  }

  return {
    passed,
    report: reportLines.join("\n"),
    commandsRun,
    failedCommand,
  };
}
