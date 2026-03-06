# Container Runtime: NanoClaw Architecture

> **Status**: Design — not yet implemented
> **Author**: Auto-generated design doc
> **Date**: 2026-03-06
> **Replaces**: AIOSandbox (`@agent-infra/sandbox`) via remote HTTP API

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current vs Target Architecture](#current-vs-target-architecture)
3. [Ephemeral Container Lifecycle](#ephemeral-container-lifecycle)
4. [Container Specifications](#container-specifications)
5. [Dockerfile Specifications](#dockerfile-specifications)
6. [Container Manager API](#container-manager-api)
7. [Filesystem IPC Pattern](#filesystem-ipc-pattern)
8. [Stream Capture](#stream-capture)
9. [Engine Integration](#engine-integration)
10. [Migration Strategy](#migration-strategy)
11. [Verification Plan](#verification-plan)

---

## Executive Summary

Replace the remote `@agent-infra/sandbox` HTTP API with **local Docker containers** managed directly by the platform process via the Docker Engine API (`dockerode`). This gives us:

- **Zero external dependencies** — no separate sandbox service to operate
- **Bind-mounted workspaces** — filesystem IPC instead of HTTP file transfer
- **Native stream capture** — `docker attach` stdout/stderr piped straight to DB
- **Simpler lifecycle** — `docker create` → `docker start` → `docker wait` → `docker rm`
- **Feature-flagged rollout** — legacy sandbox and NanoClaw coexist during migration

The name **NanoClaw** reflects the minimal, sharp-edged nature of these containers: they do exactly one job (dev or review), then vanish.

---

## Current vs Target Architecture

### Current: AIOSandbox (Remote HTTP)

```
Platform Process (Next.js)
      │
      │  HTTP / @agent-infra/sandbox SDK
      │  (SandboxClient → http://localhost:8180)
      ▼
┌──────────────────────────────────┐
│  AIOSandbox Container            │
│  (long-lived, single instance)   │
│                                  │
│  /home/gem/repos/     ← clones  │
│  /home/gem/worktrees/ ← per-run │
│  /workspaces/         ← context │
│                                  │
│  SDK API:                        │
│    sandbox.shell.execCommand()   │
│    sandbox.shell.createSession() │
│    sandbox.file.readFile()       │
│    sandbox.file.writeFile()      │
└──────────────────────────────────┘
```

**Problems**:
1. Single long-lived container — no isolation between concurrent agent runs
2. HTTP SDK has 60s timeout; requires polling workaround for long git ops
3. External dependency (`@agent-infra/sandbox`) with opaque internals
4. File I/O through HTTP — slow for large diffs, no streaming
5. Workspace cleanup is manual (`rm -rf` + `git worktree prune`)
6. Cannot enforce per-worker resource limits (CPU/mem)

### Target: NanoClaw (Local Docker)

```
Platform Process (Next.js)
      │
      │  dockerode (Docker Engine API via /var/run/docker.sock)
      │
      ├──────────────────────────────────────────────┐
      │  docker create / start / attach / wait / rm  │
      ▼                                              ▼
┌──────────────────────┐     ┌──────────────────────┐
│  nanoclaw-dev-{runId}│     │  nanoclaw-rev-{runId}│
│  (ephemeral)         │     │  (ephemeral)         │
│                      │     │                      │
│  Bind mounts:        │     │  Bind mounts:        │
│  /workspace ← host   │     │  /workspace ← host   │
│  /context   ← host   │     │  /context   ← host   │
│                      │     │                      │
│  Entrypoint:         │     │  Entrypoint:         │
│  opencode task ...   │     │  review.sh ...       │
│                      │     │                      │
│  CPU: 2 / Mem: 4GB   │     │  CPU: 1 / Mem: 2GB   │
└──────────────────────┘     └──────────────────────┘
      │                              │
      │  stdout/stderr               │  stdout/stderr
      │  (docker attach stream)      │  (docker attach stream)
      ▼                              ▼
   DB: agent_runs.terminal_output    DB: agent_runs.terminal_output
```

**Advantages**:
1. True per-run isolation — each agent gets its own container + filesystem
2. No HTTP overhead — bind mounts for file I/O, streams for output
3. No external SDK dependency — just `dockerode` (thin Docker API wrapper)
4. Native resource limits via Docker `HostConfig`
5. Automatic cleanup — `docker rm` destroys everything
6. Works offline — no remote service required

---

## Ephemeral Container Lifecycle

```
         ┌────────────────────────────────────────────────────────────────┐
         │                    Container Manager                           │
         └────────────────────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┬───────────┐
    ▼           ▼           ▼           ▼           ▼           ▼
 PREPARE     CREATE       START      STREAM      WAIT       CLEANUP
    │           │           │           │           │           │
    │  Ensure   │  docker   │  docker   │  docker   │  docker   │  docker
    │  repo     │  create   │  start    │  attach   │  wait     │  rm -f
    │  cloned   │  (image,  │  (id)     │  (stdout  │  (exit    │  (id)
    │  +branch  │   mounts, │           │   stderr  │   code)   │
    │  on host  │   env,    │           │   →DB)    │           │  rm -rf
    │           │   limits) │           │           │           │  workdir
    │           │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼           ▼
 Host FS     Container    Container   Platform    Platform    Host FS
 ready       created      running     streaming   collects    clean
                                      to DB       exit code
```

### Phase Details

#### 1. PREPARE (host-side)

Before creating the container, the platform prepares the host filesystem:

```
Host filesystem layout:

/data/nanoclaw/
├── repos/
│   └── {owner}/{name}/              ← bare clone (shared across runs)
│       └── .git/
├── runs/
│   └── {runId}/
│       ├── workspace/               ← git worktree for this run
│       │   ├── .git
│       │   └── [source files]
│       └── context/                 ← context bundle files
│           ├── prd-output.md
│           ├── implementation-plan.md
│           └── ...
└── tmp/                             ← scratch space
```

Steps:
1. `git clone --bare` the repo if not already cached in `repos/`
2. `git fetch` to update the bare clone
3. `git worktree add runs/{runId}/workspace -b agent/{runId} origin/main` (dev) or `origin/{headBranch}` (review)
4. Copy context bundle files into `runs/{runId}/context/`

All git operations happen on the host using the platform's git — no need for git inside the container for setup.

#### 2. CREATE

```typescript
const container = await docker.createContainer({
  name: `nanoclaw-${workerType}-${runId}`,
  Image: workerType === 'dev' ? NANOCLAW_DEV_IMAGE : NANOCLAW_REVIEW_IMAGE,
  Env: [
    `GITHUB_TOKEN=${token}`,
    `RUN_ID=${runId}`,
    `REPO_OWNER=${owner}`,
    `REPO_NAME=${name}`,
    `BASE_BRANCH=${baseBranch}`,
    // Dev-only:
    `ISSUE_TITLE=${issueTitle}`,
    `IMPLEMENTATION_PLAN=${planJson}`,
    // Review-only:
    `PR_NUMBER=${prNumber}`,
  ],
  HostConfig: {
    Binds: [
      `${hostRunDir}/workspace:/workspace`,
      `${hostRunDir}/context:/context:ro`,
    ],
    Memory: workerType === 'dev' ? 4 * GB : 2 * GB,
    NanoCpus: workerType === 'dev' ? 2e9 : 1e9,  // 2 CPUs / 1 CPU
    NetworkMode: 'nanoclaw-net',  // restricted network
    SecurityOpt: ['no-new-privileges'],
    AutoRemove: false,  // we remove manually after collecting logs
  },
  Cmd: workerType === 'dev'
    ? ['opencode', 'task', '--file', '/context/implementation-plan.md']
    : ['/bin/sh', '/app/review.sh'],
});
```

#### 3. START

```typescript
await container.start();
```

The container entrypoint begins execution immediately. For dev-workers this is OpenCode executing the implementation plan. For review-workers this is a shell script that runs build/test/review.

#### 4. STREAM (concurrent with execution)

```typescript
const stream = await container.attach({
  stream: true, stdout: true, stderr: true,
});

stream.on('data', (chunk) => {
  // Append to in-memory buffer
  outputBuffer.push(chunk.toString());
  // Flush to DB periodically (every 5s or 4KB)
  if (shouldFlush()) {
    await db.update(agentRuns)
      .set({ terminalOutput: outputBuffer.join('') })
      .where(eq(agentRuns.id, runId));
  }
});
```

#### 5. WAIT

```typescript
const { StatusCode } = await container.wait();
// StatusCode: 0 = success, non-zero = failure
```

#### 6. CLEANUP

```typescript
// Collect final logs
const finalOutput = outputBuffer.join('');
await db.update(agentRuns)
  .set({
    terminalOutput: finalOutput,
    status: StatusCode === 0 ? 'completed' : 'failed',
    completedAt: new Date(),
  })
  .where(eq(agentRuns.id, runId));

// Remove container
await container.remove({ force: true });

// Remove host workspace (keep repos/ cache)
await fs.rm(`/data/nanoclaw/runs/${runId}`, { recursive: true });
```

---

## Container Specifications

### Dev-Worker Container

| Property | Value |
|----------|-------|
| **Image** | `skynet-nanoclaw-dev:latest` |
| **Purpose** | Generate code, lint/fix, test, commit, push, create PR |
| **CPU** | 2 cores |
| **Memory** | 4 GB |
| **Network** | `nanoclaw-net` (GitHub API egress only) |
| **Bind mounts** | `/workspace` (rw), `/context` (ro) |
| **Entrypoint** | `opencode task --file /context/implementation-plan.md` |
| **Max lifetime** | 30 minutes (hard kill) |
| **Git permissions** | Full push (token injected via env) |
| **Env vars** | `GITHUB_TOKEN`, `RUN_ID`, `REPO_OWNER`, `REPO_NAME`, `BASE_BRANCH`, `ISSUE_TITLE`, `IMPLEMENTATION_PLAN` |

**Execution flow inside container**:
1. OpenCode reads `/context/implementation-plan.md`
2. Reads source files from `/workspace/`
3. Generates/modifies code in `/workspace/`
4. Runs `npm run lint --fix` (up to 3 iterations)
5. Runs `npm test` (1 attempt)
6. `git add . && git commit && git push`
7. Creates PR via `gh pr create` or GitHub API
8. Exits with code 0 (success) or non-zero (failure)

### Review-Worker Container

| Property | Value |
|----------|-------|
| **Image** | `skynet-nanoclaw-review:latest` |
| **Purpose** | Checkout PR, build, test, compare against PRD criteria |
| **CPU** | 1 core |
| **Memory** | 2 GB |
| **Network** | `nanoclaw-net` (GitHub API egress only, read-only) |
| **Bind mounts** | `/workspace` (ro), `/context` (rw for writing review output) |
| **Entrypoint** | `/bin/sh /app/review.sh` |
| **Max lifetime** | 15 minutes (hard kill) |
| **Git permissions** | None (read-only checkout) |
| **Env vars** | `GITHUB_TOKEN` (read-only scoped), `RUN_ID`, `PR_NUMBER`, `BASE_BRANCH` |

**Execution flow inside container**:
1. `npm install` in `/workspace/`
2. `npm run build` — verify compilation
3. `npm test` — run test suite
4. Read `/context/prd-output.md` for acceptance criteria
5. Read `git diff origin/{baseBranch}...HEAD` for changes
6. OpenCode analyzes diff against PRD criteria
7. Write `/context/review-feedback.md` with acceptance report
8. Exit 0 (review complete) or non-zero (build/test failure)

---

## Dockerfile Specifications

### Dev-Worker Dockerfile

```dockerfile
# docker/nanoclaw/Dockerfile.dev
FROM node:20-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# OpenCode CLI
ARG OPENCODE_VERSION=1.2.17
RUN curl -fsSL -o /tmp/opencode.tar.gz \
    "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
  && tar xzf /tmp/opencode.tar.gz -C /tmp \
  && mv /tmp/opencode /usr/local/bin/opencode \
  && chmod +x /usr/local/bin/opencode \
  && rm -f /tmp/opencode.tar.gz

# Git identity (overridable via env)
RUN git config --global user.name "Skynet Agent" \
  && git config --global user.email "agent@skynet.latentvibe.com"

WORKDIR /workspace

# Default entrypoint — overridden by container manager
ENTRYPOINT ["opencode"]
```

### Review-Worker Dockerfile

```dockerfile
# docker/nanoclaw/Dockerfile.review
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
  && rm -rf /var/lib/apt/lists/*

# OpenCode CLI (for AI-powered review analysis)
ARG OPENCODE_VERSION=1.2.17
RUN curl -fsSL -o /tmp/opencode.tar.gz \
    "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-x64.tar.gz" \
  && tar xzf /tmp/opencode.tar.gz -C /tmp \
  && mv /tmp/opencode /usr/local/bin/opencode \
  && chmod +x /usr/local/bin/opencode \
  && rm -f /tmp/opencode.tar.gz

# Review script
COPY docker/nanoclaw/review.sh /app/review.sh
RUN chmod +x /app/review.sh

WORKDIR /workspace

ENTRYPOINT ["/bin/sh", "/app/review.sh"]
```

### Review Script (`review.sh`)

```bash
#!/bin/sh
set -e

echo "=== NanoClaw Review Worker ==="
echo "PR: #${PR_NUMBER}"
echo "Base: ${BASE_BRANCH}"

# 1. Install dependencies
echo "--- npm install ---"
npm install --prefer-offline 2>&1

# 2. Build
echo "--- npm run build ---"
npm run build 2>&1

# 3. Test
echo "--- npm test ---"
npm test 2>&1 || true  # capture result but don't abort

TEST_EXIT=$?

# 4. Generate diff
echo "--- git diff ---"
git diff "origin/${BASE_BRANCH}...HEAD" > /tmp/pr-diff.txt

# 5. AI review against PRD
echo "--- AI acceptance review ---"
if [ -f /context/prd-output.md ]; then
  opencode task \
    --prompt "Review the PR diff against the PRD acceptance criteria. Write a structured acceptance report." \
    --context "/context/prd-output.md" \
    --context "/tmp/pr-diff.txt" \
    --output "/context/review-feedback.md"
else
  echo "No PRD found — skipping acceptance review"
  echo "# Generic Review\n\nNo PRD available for acceptance check." > /context/review-feedback.md
fi

echo "=== Review complete (test exit: ${TEST_EXIT}) ==="
exit ${TEST_EXIT}
```

### Docker Network

```yaml
# Created once during setup
docker network create nanoclaw-net \
  --driver bridge \
  --opt com.docker.network.bridge.enable_ip_masquerade=true
```

Egress rules (via iptables or Docker network policy):
- **ALLOW**: `api.github.com:443`, `github.com:443` (git push/pull)
- **ALLOW**: `host.docker.internal:3000` (platform API, for future callback use)
- **DENY**: all other egress

---

## Container Manager API

The container manager is a TypeScript module at `apps/web/lib/agent/container-manager.ts`.

### Interface

```typescript
interface ContainerRunOptions {
  runId: string;
  workerType: 'dev' | 'review';
  repoOwner: string;
  repoName: string;
  baseBranch: string;
  githubToken: string;

  // Dev-worker specific
  issueTitle?: string;
  implementationPlan?: string;

  // Review-worker specific
  prNumber?: number;
  headBranch?: string;

  // Context bundle
  contextFiles?: Record<string, string>;  // filename → content

  // Resource overrides
  memoryMB?: number;
  cpuCount?: number;
  timeoutMinutes?: number;
}

interface ContainerRunResult {
  exitCode: number;
  output: string;           // full stdout+stderr
  durationMs: number;
  // Files written by the container (read from bind mount after exit)
  artifacts: Record<string, string>;  // filename → content
}

interface ContainerManager {
  /**
   * Execute a containerized agent run end-to-end.
   * Handles: prepare → create → start → stream → wait → cleanup.
   * Returns after container exits.
   */
  run(options: ContainerRunOptions): Promise<ContainerRunResult>;

  /**
   * Force-kill a running container (for cancellation).
   */
  kill(runId: string): Promise<void>;

  /**
   * Check if a run is currently active.
   */
  isRunning(runId: string): boolean;

  /**
   * Health check — verify Docker daemon is reachable.
   */
  ping(): Promise<boolean>;
}
```

### Internal Implementation Sketch

```typescript
import Docker from 'dockerode';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const NANOCLAW_ROOT = process.env.NANOCLAW_ROOT ?? '/data/nanoclaw';
const NANOCLAW_DEV_IMAGE = process.env.NANOCLAW_DEV_IMAGE ?? 'skynet-nanoclaw-dev:latest';
const NANOCLAW_REVIEW_IMAGE = process.env.NANOCLAW_REVIEW_IMAGE ?? 'skynet-nanoclaw-review:latest';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Map of runId → Container for cancellation
const activeContainers = new Map<string, Docker.Container>();

export const containerManager: ContainerManager = {
  async run(options) {
    const { runId, workerType } = options;
    const runDir = path.join(NANOCLAW_ROOT, 'runs', runId);
    const workspaceDir = path.join(runDir, 'workspace');
    const contextDir = path.join(runDir, 'context');
    const startTime = Date.now();

    try {
      // ---- PREPARE ----
      await prepareHostFilesystem(options, runDir, workspaceDir, contextDir);

      // ---- CREATE ----
      const container = await createContainer(options, workspaceDir, contextDir);
      activeContainers.set(runId, container);

      // ---- START + STREAM + WAIT ----
      const { exitCode, output } = await startAndStream(container, runId);

      // ---- COLLECT ARTIFACTS ----
      const artifacts = await collectArtifacts(contextDir, workspaceDir);

      return {
        exitCode,
        output,
        durationMs: Date.now() - startTime,
        artifacts,
      };
    } finally {
      // ---- CLEANUP ----
      activeContainers.delete(runId);
      await cleanupContainer(runId);
      await cleanupHostDir(runDir);
    }
  },

  async kill(runId) {
    const container = activeContainers.get(runId);
    if (container) {
      await container.kill().catch(() => {});
    }
  },

  isRunning(runId) {
    return activeContainers.has(runId);
  },

  async ping() {
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  },
};
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NANOCLAW_ROOT` | `/data/nanoclaw` | Host directory for repos, runs, tmp |
| `NANOCLAW_DEV_IMAGE` | `skynet-nanoclaw-dev:latest` | Dev-worker Docker image |
| `NANOCLAW_REVIEW_IMAGE` | `skynet-nanoclaw-review:latest` | Review-worker Docker image |
| `NANOCLAW_ENABLED` | `false` | Feature flag — use NanoClaw instead of legacy sandbox |
| `NANOCLAW_DEV_TIMEOUT_MIN` | `30` | Dev container max lifetime |
| `NANOCLAW_REVIEW_TIMEOUT_MIN` | `15` | Review container max lifetime |
| `NANOCLAW_DEV_MEMORY_MB` | `4096` | Dev container memory limit |
| `NANOCLAW_REVIEW_MEMORY_MB` | `2048` | Review container memory limit |

---

## Filesystem IPC Pattern

### Why Filesystem IPC?

The legacy architecture uses HTTP to transfer files between platform and sandbox. NanoClaw replaces this with Docker bind mounts — the host and container share the same directory.

```
Host (platform process)                Container (nanoclaw)
─────────────────────                  ────────────────────
/data/nanoclaw/runs/{runId}/           /workspace/  (bind mount)
  workspace/                           /context/    (bind mount)
    src/
    package.json
    ...
  context/
    prd-output.md
    implementation-plan.md
```

### Read/Write Semantics

| Mount | Host Path | Container Path | Dev-Worker | Review-Worker |
|-------|-----------|----------------|------------|---------------|
| Workspace | `runs/{runId}/workspace` | `/workspace` | **rw** | **ro** |
| Context | `runs/{runId}/context` | `/context` | **ro** | **rw** (review-feedback.md) |

- **Dev-worker** writes code to `/workspace` (visible to host immediately) but only reads context.
- **Review-worker** reads code from `/workspace` but writes its review feedback to `/context`.

### Context Bundle Files

Written by the platform before container creation:

| File | Written By | Read By | Purpose |
|------|-----------|---------|---------|
| `prd-output.md` | Platform (Stage 1) | Dev + Review | PRD with acceptance criteria |
| `breakdown-output.md` | Platform (Stage 2) | Dev | Technical issue breakdown |
| `implementation-plan.md` | Platform (pre-dev) | Dev | Agent's implementation instructions |
| `review-feedback.md` | Review container | Platform (post-review) | Acceptance report |
| `test-results.md` | Dev/Review container | Platform | Test execution output |

### Collecting Results

After the container exits, the platform reads artifacts directly from the bind mount:

```typescript
async function collectArtifacts(contextDir: string, workspaceDir: string) {
  const artifacts: Record<string, string> = {};

  // Review feedback (written by review-worker)
  const reviewPath = path.join(contextDir, 'review-feedback.md');
  if (await fileExists(reviewPath)) {
    artifacts['review-feedback'] = await fs.readFile(reviewPath, 'utf-8');
  }

  // Test results
  const testPath = path.join(contextDir, 'test-results.md');
  if (await fileExists(testPath)) {
    artifacts['test-results'] = await fs.readFile(testPath, 'utf-8');
  }

  // Git info (branch, last commit)
  try {
    const branch = execSync('git branch --show-current', { cwd: workspaceDir }).toString().trim();
    const lastCommit = execSync('git log -1 --oneline', { cwd: workspaceDir }).toString().trim();
    artifacts['git-branch'] = branch;
    artifacts['git-last-commit'] = lastCommit;
  } catch { /* workspace may be gone */ }

  return artifacts;
}
```

---

## Stream Capture

### Docker Attach → DB

Instead of polling sandbox shell sessions (the current approach), NanoClaw attaches to the container's stdout/stderr and streams output directly to the database.

```typescript
async function startAndStream(
  container: Docker.Container,
  runId: string,
): Promise<{ exitCode: number; output: string }> {
  // Attach before starting so we don't miss early output
  const stream = await container.attach({
    stream: true,
    stdout: true,
    stderr: true,
  });

  const chunks: string[] = [];
  let lastFlush = Date.now();

  stream.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    chunks.push(text);

    // Flush to DB periodically (every 5s or when buffer exceeds 4KB)
    const bufferSize = chunks.reduce((s, c) => s + c.length, 0);
    if (Date.now() - lastFlush > 5000 || bufferSize > 4096) {
      flushToDB(runId, chunks.join(''));
      lastFlush = Date.now();
    }
  });

  // Start the container
  await container.start();

  // Wait for exit
  const { StatusCode } = await container.wait();

  // Final flush
  const fullOutput = chunks.join('');
  await flushToDB(runId, fullOutput);

  return { exitCode: StatusCode, output: fullOutput };
}

async function flushToDB(runId: string, output: string) {
  await db.update(agentRuns)
    .set({ terminalOutput: output })
    .where(eq(agentRuns.id, runId));
}
```

### Output Format

The captured output is raw terminal text — includes ANSI color codes from linters, test runners, etc. The UI can render this with a terminal emulator component (e.g., `xterm.js` or simple `<pre>` with ANSI-to-HTML).

### Timeout Enforcement

```typescript
// Hard timeout — kill container if it runs too long
const timeoutMs = (options.timeoutMinutes ?? 30) * 60 * 1000;

const timeoutHandle = setTimeout(async () => {
  console.warn(`[nanoclaw] Container ${runId} timed out after ${timeoutMs}ms`);
  await container.kill().catch(() => {});
}, timeoutMs);

try {
  const result = await container.wait();
  clearTimeout(timeoutHandle);
  return result;
} catch (err) {
  clearTimeout(timeoutHandle);
  throw err;
}
```

---

## Engine Integration

### Feature Flag

The engine (`apps/web/lib/agent/engine.ts`) will check a feature flag to decide which runtime to use:

```typescript
const USE_NANOCLAW = process.env.NANOCLAW_ENABLED === 'true';
```

### Modified Engine Flow (Dev-Worker)

```typescript
async function executeDevelopAgent(runId: string, issueId: string, options: AgentOptions) {
  // ... existing setup (session registry, context loading) ...

  if (USE_NANOCLAW) {
    // ---- NanoClaw path ----
    const result = await containerManager.run({
      runId,
      workerType: 'dev',
      repoOwner: repo.owner,
      repoName: repo.name,
      baseBranch: 'main',
      githubToken: process.env.GITHUB_TOKEN!,
      issueTitle: issue.title,
      implementationPlan: plan.summary,
      contextFiles: {
        'implementation-plan.md': plan.fullPlan,
        'prd-output.md': prdDocument ?? '',
      },
    });

    // Update agent run with results
    await updateAgentRun(runId, {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      terminalOutput: result.output,
      artifacts: Object.entries(result.artifacts).map(([name, content]) => ({
        type: 'file' as const,
        name,
        content,
      })),
    });

  } else {
    // ---- Legacy sandbox path (unchanged) ----
    const sandbox = getSandbox();
    // ... existing @agent-infra/sandbox code ...
  }
}
```

### Modified Engine Flow (Review-Worker)

```typescript
async function executeReviewAgent(runId: string, prId: string) {
  // ... existing setup ...

  if (USE_NANOCLAW) {
    const result = await containerManager.run({
      runId,
      workerType: 'review',
      repoOwner: repo.owner,
      repoName: repo.name,
      baseBranch: pr.baseBranch,
      headBranch: pr.headBranch,
      githubToken: process.env.GITHUB_TOKEN!,
      prNumber: pr.number,
      contextFiles: {
        'prd-output.md': prdDocument ?? '',
      },
    });

    // Read review feedback from artifacts
    const reviewFeedback = result.artifacts['review-feedback'] ?? '';

    await updateAgentRun(runId, {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      terminalOutput: result.output,
      artifacts: [{ type: 'review', name: 'acceptance-report', content: reviewFeedback }],
    });

  } else {
    // ---- Legacy sandbox path ----
    // ...
  }
}
```

### Worker Pool Integration

No changes to `worker-pool.ts` — it dispatches tasks to the engine, which internally routes to NanoClaw or legacy sandbox. The pool's concurrency limits (2 dev, 2 review) naturally limit Docker container count.

---

## Migration Strategy

### Phase 0: Preparation (no runtime changes)

1. Add `dockerode` to `apps/web/package.json`
2. Create `docker/nanoclaw/Dockerfile.dev` and `docker/nanoclaw/Dockerfile.review`
3. Build and tag images locally
4. Create `nanoclaw-net` Docker network
5. Create `/data/nanoclaw/` directory structure on host
6. Add environment variables to `.env`

### Phase 1: Container Manager (isolated module)

1. Implement `container-manager.ts` with full lifecycle
2. Write integration test: create container, run `echo hello`, capture output, cleanup
3. Verify bind mount read/write from both host and container
4. Verify timeout enforcement (container killed after limit)
5. Verify `kill()` for cancellation

### Phase 2: Feature-Flagged Engine Integration

1. Add `NANOCLAW_ENABLED=false` to `.env`
2. Wire `containerManager.run()` into `executeDevelopAgent` and `executeReviewAgent`
3. Test with `NANOCLAW_ENABLED=true` on a single issue
4. Compare output quality with legacy sandbox on same issue
5. Monitor resource usage (Docker stats)

### Phase 3: Validation & Cutover

1. Run 5+ dev-worker and 5+ review-worker tasks through NanoClaw
2. Verify: git push works, PRs created, review feedback generated
3. Verify: worker pool concurrency respected (no more than 2+2 containers)
4. Verify: cleanup leaves no orphaned containers or directories
5. Flip `NANOCLAW_ENABLED=true` as default
6. Keep legacy sandbox code for 2 weeks as fallback

### Phase 4: Cleanup

1. Remove `@agent-infra/sandbox` dependency
2. Remove `apps/web/lib/sandbox/` directory
3. Remove legacy sandbox code paths from engine
4. Remove `SANDBOX_URL` environment variable
5. Update `docker-compose.yml` — remove `sandbox` service, add `nanoclaw-dev` and `nanoclaw-review` build targets
6. Update this document to mark migration as complete

### Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Docker daemon unavailable | `containerManager.ping()` health check; fallback to legacy |
| Container hangs | Hard timeout with `container.kill()` |
| Disk space exhaustion | Cleanup on every run; periodic `/data/nanoclaw/tmp` prune |
| Image not built | Startup check: verify images exist, log warning |
| Permission errors on bind mount | Run platform process with Docker group access; document setup |
| Port conflicts | No port mapping needed — containers talk to host via `host.docker.internal` |

---

## Verification Plan

### Unit Tests

| Test | Validates |
|------|-----------|
| `containerManager.ping()` returns true | Docker daemon reachable |
| `containerManager.run()` with `echo` command | Full lifecycle: create → start → wait → cleanup |
| Stream capture captures all output | No dropped bytes, correct ordering |
| Timeout kills container | Container stopped after `timeoutMinutes` |
| `containerManager.kill()` stops running container | Cancellation works |
| Cleanup removes container and host dir | No orphaned resources |
| Feature flag routes to correct runtime | `NANOCLAW_ENABLED` respected |

### Integration Tests

| Test | Validates |
|------|-----------|
| Dev-worker: clone repo, write file, commit, push | Full dev lifecycle in container |
| Dev-worker: lint failure → retry loop | Iteration policy works |
| Review-worker: checkout PR, build, test | Full review lifecycle |
| Review-worker: read PRD, write feedback | Context bundle IPC works |
| Concurrent runs (2 dev + 2 review) | No filesystem or resource conflicts |
| Run after cancellation | Cleanup state allows re-use |

### Smoke Tests (Manual)

1. Start a dev-worker run from the UI → verify PR created
2. Start a review-worker run from the UI → verify acceptance report displayed
3. Cancel a running agent → verify container killed and status updated
4. Check `/data/nanoclaw/runs/` after completion → verify empty (cleaned up)
5. Run `docker ps -a | grep nanoclaw` → verify no orphaned containers

---

## Appendix: Docker Compose (Development)

For local development, both NanoClaw images can be built via docker-compose:

```yaml
# docker-compose.yml (additions)
services:
  # ... existing matrixone service ...

  nanoclaw-dev:
    build:
      context: .
      dockerfile: docker/nanoclaw/Dockerfile.dev
    image: skynet-nanoclaw-dev:latest
    profiles: ["build-only"]  # not a running service

  nanoclaw-review:
    build:
      context: .
      dockerfile: docker/nanoclaw/Dockerfile.review
    image: skynet-nanoclaw-review:latest
    profiles: ["build-only"]
```

Build images:

```bash
docker compose build nanoclaw-dev nanoclaw-review
```

These images are not long-running services — they're only used as base images for ephemeral containers created by `container-manager.ts`.
