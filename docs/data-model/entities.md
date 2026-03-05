# Data Model - Core Entities

## Requirement

顶层需求实体，聚合 PRD 文档与关联 Issue 列表，驱动完整六阶段研发生命周期。

```typescript
interface Requirement {
  id: string;              // UUID v4
  title: string;
  description: string;     // 原始需求描述（一段话到多段话）

  // 生命周期阶段（单向流转）
  stage: RequirementStage;

  // 关联
  repositoryId?: string;
  createdBy: string;       // GitHub username

  // PRD 文档（复用 synthesizedDocument 机制）
  prdDocument?: string;    // Markdown，含验收标准

  // 阶段时间戳（用于度量）
  createdAt: Date;
  prdFinalizedAt?: Date;   // Stage 1 完成
  issuesCreatedAt?: Date;  // Stage 2 完成（所有 issues 已创建）
  allMergedAt?: Date;      // Stage 3 完成（所有 PR 合并）
  acceptedAt?: Date;       // Stage 5 完成（需求验收通过）
}

type RequirementStage =
  | 'discovery'    // Stage 0: 需求发现，初始状态
  | 'prd'          // Stage 1: PRD 已 Finalize
  | 'breakdown'    // Stage 2: Issues 已创建
  | 'development'  // Stage 3: 实现中
  | 'acceptance'   // Stage 4-5: Review & 验收中
  | 'closed';      // 需求已关闭
```

**阶段流转规则**：单向，不可回退（`closed` 可 reopen 为 `acceptance`）。

**关联关系**：
```
Requirement
  ├── Issue[] (1:N, 技术拆解产物，issues.requirementId 软关联)
  ├── prdDocument (内嵌字段，结构化 PRD + 验收标准)
  └── AgentSession[] (各阶段 session 注册)
```

**PRD 文档结构**（由 PRD Agent 生成）：
```markdown
## 背景与目标
## 用户故事
## 功能需求
## 非功能需求
## 技术约束（从代码分析得出）
## 验收标准（每条可被自动化验证）
## 开放问题
```

---

## Issue

The central entity representing a GitHub issue with AI enrichment.

```typescript
interface Issue {
  // Primary identifiers
  id: string;                    // UUID v4
  githubId: number;              // GitHub's issue ID
  number: number;                // Issue number in repo
  repoOwner: string;             // Repository owner
  repoName: string;              // Repository name

  // Core content (from GitHub)
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Label[];
  assignee?: User;

  // AI-enriched fields
  aiType?: 'bug' | 'feature' | 'task' | 'question';
  aiPriority?: 'P0' | 'P1' | 'P2' | 'P3';
  aiSummary?: string;            // Concise AI-generated summary
  aiTags?: string[];             // Auto-generated tags
  aiAnalysis?: IssueAnalysis;    // Detailed analysis
  duplicateOf?: number;          // Reference to duplicate issue
  relatedIssues?: number[];      // Related issue numbers

  // Requirement linkage (新增)
  requirementId?: string;        // 关联的 Requirement（nullable，软关联）

  // Sync metadata
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
  lastAnalyzedAt?: Date;
}

interface Label {
  name: string;
  color: string;
  description?: string;
}
```

## IssueAnalysis

Detailed AI-generated analysis of an issue.

```typescript
interface IssueAnalysis {
  // Implementation approach
  approach?: string;

  // Code organization
  affectedModules?: string[];
  affectedFiles?: string[];

  // Effort estimation
  estimatedComplexity?: 'small' | 'medium' | 'large';
  estimatedHours?: number;

  // Risk assessment
  blockers?: string[];
  risks?: string[];

  // Team suggestions
  suggestedAssignees?: string[];
  requiredSkills?: string[];

  // Code context
  relatedCode?: CodeReference[];
}

interface CodeReference {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  snippet: string;
  relevance: number;  // 0-1 score
}
```

## AgentRun

Tracks the execution of an AI agent for implementing an issue.

```typescript
interface AgentRun {
  // Identifiers
  id: string;
  issueId: string;
  startedBy: string;  // User ID

  // Status tracking
  status: AgentStatus;

  // Execution details
  plan?: ImplementationPlan;
  branch?: string;
  prNumber?: number;

  // Timeline
  startedAt: Date;
  completedAt?: Date;

  // Logs and output
  logs: AgentLog[];
  artifacts?: AgentArtifact[];
}

type AgentStatus =
  | 'planning'      // Generating implementation plan
  | 'coding'        // Writing code
  | 'testing'       // Running tests
  | 'review'        // Awaiting human review
  | 'cancelled'     // Cancelled by user
  | 'completed'     // Successfully completed
  | 'failed';       // Failed (see logs)

interface AgentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

interface AgentArtifact {
  type: 'file' | 'diff' | 'test_result' | 'ci_result';
  path?: string;
  content?: string;
  url?: string;
}
```

## ImplementationPlan

AI-generated plan for implementing an issue.

```typescript
interface ImplementationPlan {
  summary: string;
  approach: string;

  // Files to modify/create
  files: PlannedFile[];

  // Testing strategy
  tests: PlannedTest[];

  // Dependencies
  dependencies: string[];

  // Risks and mitigations
  risks: Risk[];

  // Questions to resolve
  openQuestions?: string[];
}

interface PlannedFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
  estimatedLines?: number;
}

interface PlannedTest {
  type: 'unit' | 'integration' | 'e2e';
  description: string;
  filePath?: string;
}

interface Risk {
  description: string;
  mitigation: string;
  severity: 'low' | 'medium' | 'high';
}
```

## Discussion / Thread

Chat and collaboration around issues.

```typescript
interface Discussion {
  id: string;
  issueId: string;

  // Thread type
  type: 'issue_chat' | 'plan_review' | 'code_review';

  // Participants
  participants: string[];  // User IDs

  // Messages
  messages: Message[];

  // AI synthesis
  synthesizedDocument?: string;
  lastSynthesizedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  discussionId: string;
  authorId: string;
  authorType: 'user' | 'ai';

  content: string;

  // For AI messages
  aiContext?: {
    fetchedCode?: boolean;
    referencedFiles?: string[];
  };

  createdAt: Date;
}
```

## User

Platform user (cross-functional team member).

```typescript
interface User {
  id: string;
  githubId: number;
  username: string;
  avatarUrl?: string;

  // Role in team
  role: 'engineer' | 'pm' | 'designer' | 'operator';

  // Preferences
  preferences: UserPreferences;

  // Timestamps
  createdAt: Date;
  lastLoginAt?: Date;
}

interface UserPreferences {
  notifications: {
    email: boolean;
    webhook?: string;
    mentionsOnly: boolean;
  };
  viewSettings: {
    defaultDashboard: 'org' | 'personal';
    issueListColumns: string[];
  };
}
```

## Activity

Cross-functional visibility feed.

```typescript
interface Activity {
  id: string;
  type: ActivityType;

  // Context
  repoOwner?: string;
  repoName?: string;
  issueNumber?: number;
  agentRunId?: string;

  // Actor
  actorId: string;
  actorType: 'user' | 'ai' | 'system';

  // Content
  title: string;
  description?: string;
  metadata?: Record<string, any>;

  createdAt: Date;
}

type ActivityType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_closed'
  | 'agent_started'
  | 'agent_completed'
  | 'agent_failed'
  | 'pr_created'
  | 'pr_merged'
  | 'plan_generated'
  | 'plan_finalized'
  | 'comment_added'
  // Requirement lifecycle events（新增）
  | 'requirement_created'
  | 'requirement_prd_generated'
  | 'requirement_prd_finalized'
  | 'requirement_issues_created'
  | 'requirement_accepted'
  | 'requirement_closed';
```

## AgentSession

跨容器 Session 注册表，管理 Claude Agent SDK session ID 的生命周期，支持 resume 和并发隔离。

```typescript
interface AgentSession {
  id: string;             // UUID v4

  // 唯一标识本次 session 的语义 key
  // 格式：{task_id}:{stage}:{sub_id}
  // 示例：
  //   "issue:42:triage:main"        → Issue 分析阶段
  //   "issue:42:implement:main"     → dev-worker 实现
  //   "pr:101:review:main"          → review-worker 验收
  //   "req-101:implement:issue-42"  → 并行子任务
  sessionKey: string;

  // Claude Agent SDK 返回的 session ID（加密存储）
  sessionId: string;

  // Worker 类型
  workerType: 'platform' | 'dev' | 'review';

  // 状态流转：active → paused（等人类 gate）→ active（resume）→ completed
  status: 'active' | 'paused' | 'completed' | 'failed';

  // 时间戳
  createdAt: Date;
  resumedAt?: Date;
  completedAt?: Date;
}
```

**四种并发场景**：

| 场景 | 处理方式 |
|------|---------|
| 同类 worker 并发 | session_key 不同，天然隔离 |
| 跨阶段 handoff | 新 session，通过 Context Bundle 文件传递上下文 |
| 同阶段多轮（人类审批后） | 相同 session_key，`query({resume: sessionId})` |
| 并行子任务 | 独立 session + 共享 Context Bundle 目录 |

**Context Bundle 目录结构**：

```
/workspaces/req-{id}/context/
  triage-output.md        ← Stage 0 写入（查重结果、优先级）
  prd-output.md           ← Stage 1 写入（完整 PRD）
  breakdown-output.md     ← Stage 2 写入（Issue 列表）
  implementation-plan.md  ← Stage 3 写入（dev-worker 执行计划）
  test-results.md         ← Stage 4 写入（Review 验收报告）

/workspaces/pr-{N}/context/  ← PR 创建时从 issue context 复制
  prd-output.md           ← review-worker 读取验收标准
  implementation-plan.md
  review-feedback.md      ← review-worker 写入（验收不通过时）
```

---

## Repository

Connected GitHub repository.

```typescript
interface Repository {
  id: string;
  owner: string;
  name: string;

  // GitHub metadata
  githubId: number;
  description?: string;
  isPrivate: boolean;
  defaultBranch: string;

  // AI configuration
  aiConfig: RepositoryAIConfig;

  // Sync state
  lastSyncedAt?: Date;
  syncEnabled: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

interface RepositoryAIConfig {
  enabled: boolean;
  autoAnalyze: boolean;
  autoDetectDuplicates: boolean;
  customPrompts?: {
    analysis?: string;
    summary?: string;
  };
}
```
