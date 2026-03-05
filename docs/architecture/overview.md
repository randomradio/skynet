# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI-Native Development Platform (Web/API)                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Web UI (Next.js)                                 ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │  Dashboard  │  │   Issues    │  │  Agents     │  │  Team Activity  │ ││
│  │  │  (Org view) │  │  (Repo view)│  │  (Control)  │  │   (Timeline)    │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       │                                      │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    API Server (Next.js API Routes)                       ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │  GitHub     │  │   Issues    │  │  Agents     │  │   Real-time     │ ││
│  │  │  Webhooks   │  │  CRUD       │  │  Manager    │  │   (WebSocket)   │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
        ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
        │   MatrixOne   │   │  GitHub API   │   │   AIOSandbox      │
        │   (Metadata)  │   │  (Source of   │   │  (Agent Execution)│
        │               │   │   truth)      │   │                   │
        └───────────────┘   └───────────────┘   └───────────────────┘
                                                       │
                                                       │ SSH/API
                                                       ▼
                                            ┌─────────────────────┐
                                            │  Ephemeral Container │
                                            │  - Code generation   │
                                            │  - Test execution    │
                                            │  - Git operations    │
                                            └─────────────────────┘
```

## 三层 Agent 架构

```
Layer 1  Platform Agent（类 nanoclaw）
  ✅ 读文件 / 搜索代码（keyword + vector）
  ✅ 访问外部信息（issues, PRs, discussions, GitHub API）
  ✅ 生成/更新结构化文档（PRD、活文档、验收报告）
  ❌ 无 terminal 执行，❌ 无容器
  运行位置：主应用进程内，直接调 AI API

Layer 2  Coding Container（dev-worker，AIOSandbox Container A）
  ✅ 全部 Layer 1 能力
  ✅ terminal 执行（lint, test, build，循环迭代）
  ✅ git 操作（branch, commit, push, PR）
  ✅ 写文件权限（限 /workspace）
  运行位置：AIOSandbox 隔离容器，无外部网络

Layer 3  Review Container（review-worker，AIOSandbox Container B）
  ✅ Checkout PR branch（只读）
  ✅ npm install / build / test
  ✅ Review Agent：读 diff + 对照 PRD 验收标准
  ❌ 无写文件权限，❌ 无 git push
  运行位置：AIOSandbox 独立隔离容器，有测试 DB + mock 服务
```

## 完整六阶段生命周期

```
Stage 0  需求发现      Layer 1   读已有 issues → 查重/结构化/估优先级
Stage 1  PRD 编写      Layer 1   需求描述 + 代码上下文 → 结构化 PRD（含验收标准）
Stage 2  技术拆解      Layer 1   PRD + 代码结构 → Issue[] + 复杂度估算 + 依赖图
Stage 3  实现          Layer 2   opencode → branch → commit → PR
Stage 4  Review        Layer 3   checkout → build/test → Review Agent 对照 PRD 验收
Stage 5  验收关闭      Layer 1   PRD 验收标准 × 测试结果 = checklist → 需求关闭
```

**Issue → PR 生命周期映射**：

```
issue:{id} session（Stage 0-3）
  ↓ dev-worker 写代码，创建 PR #N
  ↓ copyContextBundleToPR(issueId, N)  ← Context Bundle 复制

pr:{N} session（Stage 4-5）
  ↓ review-worker 读 PRD 验收标准，运行测试
  ↓ 生成验收报告（✅/❌/⚠️）
  ↓ 通过 → requirement.acceptedAt 记录 → closed
  ↓ 不通过 → feedback → resume issue session → 修复 → 重跑 review
```

## Component Responsibilities

### AI-Native Development Platform (Server)

**Web UI (Next.js 15 + React)**
- **Dashboard**: Organization-level view across all repos（含需求漏斗度量图）
- **Requirements**: 需求列表和详情页（PRD 编辑器、Issue 拆解预览）
- **Issues**: Repository issue list and detail views
- **Discussions**: Chat interface with AI participation
- **Agents**: Agent control panel for starting/stopping agents（含 WorkerPool 队列状态）

**API Server (Next.js API Routes)**
- **GitHub Webhooks**: Receive and process GitHub events
- **Requirements CRUD**: Requirement 实体增删改查，PRD 生成，技术拆解
- **Issues CRUD**: Manage issue metadata and AI enrichment
- **Discussion Manager**: Handle chat threads and AI responses
- **Agent Manager**: Control AIOSandbox agent lifecycle（含 WorkerPool dispatch）
- **Session Registry**: 管理 Claude session ID，支持跨阶段 resume
- **Real-time**: WebSocket server for live updates

### Data Layer

| Component | Purpose | Location |
|-----------|---------|----------|
| **MatrixOne** | Issue metadata, AI analysis, discussions, activity logs | Cloud/Existing |
| **GitHub API** | Source of truth for issues, PRs, repository data | Cloud |
| **AIOSandbox** | Isolated environment for agent code execution | Cloud/Remote |

### AIOSandbox Architecture (Docker)

两种容器类型，职责不同：

```
Container A：dev-worker（Layer 2）
├── Docker Container (ephemeral, per-agent-run)
│   ├── Agent Runtime (Node.js)
│   ├── Code Workspace (mounted volume, 可写)
│   ├── Test Environment (dependencies pre-installed)
│   └── Git Configuration（有 push 权限）
├── Network Policies
│   ├── Platform API: ALLOW (for logs/status/context bundle)
│   ├── GitHub API: ALLOW
│   └── External internet: DENY
└── Context Bundle: /workspaces/req-{id}/context/ (挂载，可读写)

Container B：review-worker（Layer 3，新增）
├── Docker Container (ephemeral, per-PR-review)
│   ├── Agent Runtime (Node.js)
│   ├── Code Workspace (mounted volume, 只读 checkout)
│   ├── Test Environment (测试 DB + mock 服务)
│   └── Git Configuration（无 push 权限）
├── Network Policies
│   ├── Platform API: ALLOW
│   ├── GitHub API: ALLOW (只读)
│   └── 测试 DB: ALLOW（不连生产）
└── Context Bundle: /workspaces/pr-{N}/context/ (挂载，可读；test-results.md 可写)
```

**AIOSandbox Lifecycle:**
1. **Provision**: Platform API calls Sandbox Manager to create container
2. **Setup**: Clone repo, checkout base branch, install dependencies
3. **Execute**: Run agent with implementation plan
4. **Monitor**: Agent calls Platform API to report logs/status
5. **Collect**: Platform gathers results (diffs, test results, PR link)
6. **Destroy**: Platform API calls Sandbox Manager to destroy container

## Technical Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework with App Router |
| React + TypeScript | UI components |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| TanStack Query | Data fetching and caching |
| WebSocket | Real-time updates |

### Backend
| Technology | Purpose |
|------------|---------|
| Next.js API Routes | API server |
| Drizzle ORM | Type-safe database queries |
| MatrixOne | Primary database (via MySQL protocol) |
| WebSocket (ws) | Real-time communication |

### AI Integration
| Technology | Purpose |
|------------|---------|
| Anthropic SDK | Claude API for analysis and chat |
| Vercel AI SDK | Streaming responses |
| MCP (Model Context Protocol) | Tool integration |

### AIOSandbox Agent Runtime
| Technology | Purpose |
|------------|---------|
| Node.js 20 | Agent runtime |
| Docker/Container | Isolation |
| GitHub CLI | PR creation |
| MCP Client | Tool access (filesystem, terminal) |

## Data Flow

### Issue Sync Flow
```
GitHub Webhook → Platform API → MatrixOne (raw data)
                                      ↓
                                AI Analysis
                                      ↓
                                MatrixOne (enriched)
                                      ↓
                                WebSocket → UI Update
```

### Discussion with AI Flow
```
User posts message → Platform API
                          ↓
                    Fetch relevant code (MCP)
                          ↓
                    AI generates response
                          ↓
                    Update Living Document
                          ↓
                    WebSocket → UI Update
```

### Issue → Agent Execution Flow
```
User clicks "Start Implementation"
         ↓
Platform generates implementation plan
         ↓
API: POST /sandbox/provision
         ↓
Docker container created, repo cloned
         ↓
Agent starts in container
    ┌─────────────────────────────────────┐
    │ Generate code                       │
    │ Run lint (auto-fix loop, max 3)     │
    │ Run tests locally                   │
    │ POST /runs/{id}/logs (progress)     │
    │ Create branch, commit, push         │
    │ Create PR                           │
    └─────────────────────────────────────┘
         ↓
API: POST /runs/{id}/complete
         ↓
Platform receives results, PR link
         ↓
API: POST /sandbox/destroy
         ↓
Container destroyed
```

## Iteration Policy

### Local Iteration (in AIOSandbox)

| Stage | Max Iterations | Auto-fix | On Failure |
|-------|----------------|----------|------------|
| Lint errors | 3 | Yes | Handoff to human |
| Type errors | 3 | Yes | Handoff to human |
| Local tests | 1 | No | Handoff to human |
| Build | 2 | Yes | Handoff to human |

### CI Iteration

| Stage | Max Iterations | Auto-fix | On Failure |
|-------|----------------|----------|------------|
| CI lint | 0 (should pass local) | No | Human review |
| CI test | 1 | Yes | Human review |
| Integration test | 0 | No | Human review |

### Handoff Criteria

Agent execution hands off to human when:
1. Lint/type errors persist after max iterations
2. Local tests fail (agent analyzes but doesn't auto-fix)
3. CI failures after one retry
4. Agent confidence score < 0.7
5. User explicitly requested review at checkpoint

## Security Considerations

### AIOSandbox Security
- **Network**: No egress except GitHub API and platform WebSocket
- **Filesystem**: Isolated container, no host access
- **Secrets**: Injected as env vars, not persisted
- **Resource limits**: CPU/memory/disk caps per sandbox
- **Lifetime**: Auto-destroy after timeout (1 hour max)

### Platform Security
- GitHub OAuth with minimal scopes
- Webhook signature verification
- Database credentials in environment variables
- No sensitive data in logs

## Sandbox API Protocol

Platform ↔ AIOSandbox 通信采用 HTTP API。

### Sandbox Manager API (Platform → Sandbox)

```typescript
// POST /sandbox/provision
interface ProvisionRequest {
  repoOwner: string;
  repoName: string;
  branch: string;           // Base branch to checkout
  agentRunId: string;       // For logging correlation
  env: Record<string, string>; // Secrets (GitHub token, etc.)
}

interface ProvisionResponse {
  sandboxId: string;
  apiEndpoint: string;      // e.g., http://sandbox-123:8080
  status: 'provisioning' | 'ready' | 'failed';
}

// POST /sandbox/{id}/destroy
interface DestroyResponse {
  sandboxId: string;
  status: 'destroyed';
  logs: string[];           // Final container logs
}
```

### Agent Runtime API (Sandbox → Platform)

```typescript
// POST /runs/{id}/logs
interface LogRequest {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

// POST /runs/{id}/status
interface StatusRequest {
  status: AgentStatus;
  progress?: {
    current: number;
    total: number;
    description: string;
  };
}

// POST /runs/{id}/complete
interface CompleteRequest {
  status: 'completed' | 'failed';
  prNumber?: number;
  branch?: string;
  summary: string;
  artifacts?: {
    type: 'diff' | 'test_report' | 'lint_report';
    content: string;
  }[];
}
```

### Sandbox-Side Agent Runtime

```typescript
// Agent runs inside Docker container
// Environment variables injected by Platform:
// - PLATFORM_API_URL=http://host.docker.internal:3000/api
// - AGENT_RUN_ID=uuid
// - GITHUB_TOKEN=secret

// Agent polls or calls Platform API to report progress
// Simple polling loop every 5 seconds for status checks
```

### Docker Configuration

```dockerfile
# Dockerfile.sandbox
FROM node:20-alpine

WORKDIR /workspace

# Install git, GitHub CLI
RUN apk add --no-cache git gh

# Copy agent runtime
COPY apps/agent-runtime/dist /app
COPY apps/agent-runtime/node_modules /app/node_modules

# Expose API port (optional, mainly for health checks)
EXPOSE 8080

# Start agent
CMD ["node", "/app/index.js"]
```

```yaml
# docker-compose.sandbox.yml
version: '3.8'
services:
  sandbox:
    build:
      context: .
      dockerfile: Dockerfile.sandbox
    environment:
      - PLATFORM_API_URL=${PLATFORM_API_URL}
      - AGENT_RUN_ID=${AGENT_RUN_ID}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # For sibling containers
    network_mode: bridge
    cpu_count: 2
    mem_limit: 4g
```

## MCP (Model Context Protocol) Integration

### MCP Servers

**Platform-side MCP (for AI analysis):**
```yaml
servers:
  github-search:
    type: stdio
    command: mcp-github-search
    # Search code in repo

  vector-search:
    type: stdio
    command: mcp-vector-search
    # Semantic code search
```

**AIOSandbox-side MCP (for agent execution):**
```yaml
servers:
  filesystem:
    type: stdio
    command: mcp-filesystem
    args: ["/workspace"]
    # Restricted to workspace

  terminal:
    type: stdio
    command: mcp-terminal
    # Sandboxed terminal access

  github:
    type: stdio
    command: mcp-github
    # GitHub CLI operations
```

### MCP Tool Examples

**Code Search:**
```typescript
// Platform AI searches for relevant code
const result = await mcp.github_search.query({
  repo: "matrixorigin/matrixone",
  query: "executor query cache",
  language: "go"
});
```

**File Operations (in AIOSandbox):**
```typescript
// Agent reads file
const content = await mcp.filesystem.read({
  path: "/workspace/pkg/sql/executor.go"
});

// Agent writes file
await mcp.filesystem.write({
  path: "/workspace/pkg/sql/executor.go",
  content: updatedCode
});
```

## Rules File Structure

Based on Claude Code skills pattern, agents will use:

```
repo/
├── .ai/
│   ├── AGENTS.md              # Root agent instructions
│   ├── rules/                 # Modular rules
│   │   ├── coding-style.md
│   │   ├── testing-guidelines.md
│   │   └── architecture-patterns.md
│   └── plans/                 # Generated plans
│       └── plan-{issue-number}.md
└── .cursorrules               # Cursor IDE rules (synced)
```

**AGENTS.md Structure:**
```markdown
---
name: matrixone-agent
description: Agent for MatrixOne database development
---

# Agent Context

## Code Style
- Follow Go best practices
- Use table-driven tests
- Error handling: wrap with context

## Architecture Patterns
- Layered architecture: pkg/sql, pkg/vm, etc.
- Interface definitions in *_types.go files

## Testing Requirements
- Unit tests for all new functions
- Integration tests for SQL features
- Benchmarks for performance-critical code

## MCP Tools Available
- filesystem: Read/write files in /workspace
- terminal: Run commands in sandbox
- github: PR creation, issue updates
```

## Scalability Considerations

### Current Scope (MVP)
- Single organization
- AIOSandbox instances on-demand
- WebSocket connections via platform server

### Future Scaling
- Redis for WebSocket broadcasting (multi-server)
- AIOSandbox pool pre-warming
- Sandbox queue for rate limiting
- Database read replicas

## WorkerPool 并发管理

```typescript
WorkerPool {
  'dev':    { maxConcurrent: 2, queue: Task[], active: Map<workerId, Task> }
  'review': { maxConcurrent: 2, queue: Task[], active: Map<workerId, Task> }
}

// 分发逻辑
dispatch(task):
  if pool.active.size < pool.maxConcurrent:
    assignToWorker(task)     // 立即分配
  else:
    pool.queue.push(task)    // 排队，UI 显示位置

// 完成后自动取下一个
onWorkerDone(workerId):
  pool.active.delete(workerId)
  if pool.queue.length > 0:
    assignToWorker(pool.queue.shift())
```

## 时间度量模型

```
Requirement 时间戳:
  createdAt          ← 需求创建
  prdFinalizedAt     ← Stage 1 完成
  issuesCreatedAt    ← Stage 2 完成
  allMergedAt        ← Stage 3 完成
  acceptedAt         ← Stage 5 完成

派生指标:
  需求澄清周期  = prdFinalizedAt - createdAt
  技术规划周期  = issuesCreatedAt - prdFinalizedAt
  实现周期      = allMergedAt - issuesCreatedAt
  验收周期      = acceptedAt - allMergedAt
  端到端周期    = acceptedAt - createdAt
```

## Open Questions (Resolved for MVP)

| Question | Decision |
|----------|----------|
| Agent isolation | AIOSandbox containers（Container A: dev, Container B: review） |
| CI integration | Local tests in sandbox + GitHub Actions |
| Authentication | GitHub OAuth + Bearer JWT |
| Real-time updates | WebSocket |
| MCP scope | filesystem, terminal, github |
| Iteration policy | Defined above with handoff criteria |
| Session management | agent_sessions 表 + Context Bundle 文件系统 |
| Requirement entity | 独立 requirements 表，issues 软关联 |
| Worker concurrency | WorkerPool 队列，dev 2 并发，review 2 并发 |
