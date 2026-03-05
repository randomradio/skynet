# API Endpoints Specification

## Authentication

All API requests (except GitHub webhook endpoint) require platform-issued Bearer JWT.

```
Authorization: Bearer <jwt_token>
```

### GitHub OAuth Callback

```http
GET /api/auth/github/callback?code={github_oauth_code}
```

Exchanges the GitHub OAuth `code`, fetches GitHub user profile, issues a platform Bearer JWT, and sets the HTTP-only session cookie used by protected pages and APIs.

**Success Response (`201`):**

```json
{
  "accessToken": "<platform_jwt>",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "sub": "github:123456",
    "username": "octocat",
    "provider": "github",
    "githubId": 123456
  }
}
```

**Error Response (contract):**

```json
{
  "error": {
    "code": "INVALID_GITHUB_OAUTH_CODE",
    "message": "The code passed is incorrect or expired."
  }
}
```

---

## Issues API

### List Issues
```http
GET /api/issues?repo_owner={owner}&repo_name={name}&state={open|closed|all}&page={n}&limit={n}
```

**Response:**
```json
{
  "issues": [
    {
      "id": "uuid",
      "number": 123,
      "title": "Issue title",
      "state": "open",
      "aiType": "bug",
      "aiPriority": "P1",
      "aiSummary": "Brief AI summary",
      "labels": [{"name": "bug", "color": "ff0000"}],
      "assignee": {"username": "user", "avatarUrl": "..."},
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### Get Issue Detail
```http
GET /api/issues/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "githubId": 123456,
  "number": 123,
  "repoOwner": "matrixorigin",
  "repoName": "matrixone",
  "title": "Issue title",
  "body": "Full markdown body...",
  "state": "open",
  "labels": [...],
  "assignee": {...},
  "aiType": "bug",
  "aiPriority": "P1",
  "aiSummary": "AI-generated summary",
  "aiTags": ["performance", "sql"],
  "aiAnalysis": {
    "approach": "Suggested approach...",
    "affectedModules": ["pkg/sql"],
    "estimatedComplexity": "medium",
    "blockers": [...],
    "suggestedAssignees": [...]
  },
  "duplicateOf": null,
  "relatedIssues": [456, 789],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "syncedAt": "2024-01-15T10:00:00Z"
}
```

### Trigger AI Analysis
```http
POST /api/issues/{id}/analyze
```

**Response (async):**
```json
{
  "analysisId": "uuid",
  "status": "queued",
  "estimatedDuration": "30s"
}
```

### Get Related Code Context
```http
GET /api/issues/{id}/code-context
```

**Response:**
```json
{
  "issueId": "uuid",
  "codeReferences": [
    {
      "filePath": "pkg/sql/executor.go",
      "lineStart": 45,
      "lineEnd": 67,
      "snippet": "code...",
      "relevance": 0.92
    }
  ]
}
```

---

## Discussions API

### Get Issue Discussion
```http
GET /api/issues/{issueId}/discussion
```

**Response:**
```json
{
  "id": "uuid",
  "issueId": "uuid",
  "type": "issue_chat",
  "participants": ["user1", "user2"],
  "synthesizedDocument": "# Implementation Plan\n...",
  "lastSynthesizedAt": "2024-01-15T10:00:00Z",
  "messages": [
    {
      "id": "uuid",
      "authorId": "user1",
      "authorType": "user",
      "content": "Let's discuss the approach...",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "authorId": "ai",
      "authorType": "ai",
      "content": "Based on the codebase...",
      "aiContext": {
        "fetchedCode": true,
        "referencedFiles": ["pkg/sql/executor.go"]
      },
      "createdAt": "2024-01-15T10:01:00Z"
    }
  ]
}
```

### Post Message
```http
POST /api/issues/{issueId}/discussion/messages
Content-Type: application/json

{
  "content": "Message text...",
  "mentions": ["user2"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "authorId": "user1",
  "authorType": "user",
  "content": "Message text...",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### Finalize Discussion
```http
POST /api/issues/{issueId}/discussion/finalize
```

Locks the synthesized document and marks it ready for execution.

**Response:**
```json
{
  "finalizedDocument": "# Final Implementation Plan\n...",
  "finalizedAt": "2024-01-15T10:00:00Z",
  "canExecute": true
}
```

---

## Agent API

### List Agent Runs
```http
GET /api/agents?status={status}&page={n}&limit={n}
```

**Response:**
```json
{
  "runs": [
    {
      "id": "uuid",
      "issueId": "uuid",
      "issueNumber": 123,
      "issueTitle": "Issue title",
      "status": "coding",
      "startedBy": "user1",
      "startedAt": "2024-01-15T10:00:00Z",
      "branch": "agent/issue-123-fix",
      "prNumber": 456
    }
  ]
}
```

### Start Agent Run
```http
POST /api/agents
Content-Type: application/json

{
  "issueId": "uuid",
  "options": {
    "autoCreatePR": true,
    "runTests": true,
    "maxIterations": 2
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "planning",
  "issueId": "uuid",
  "startedAt": "2024-01-15T10:00:00Z",
  "wsEndpoint": "/ws/agents/{id}"
}
```

### Get Agent Run Detail
```http
GET /api/agents/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "issueId": "uuid",
  "startedBy": "user1",
  "status": "coding",
  "plan": {
    "summary": "Implement feature X",
    "files": [...],
    "tests": [...]
  },
  "branch": "agent/issue-123-fix",
  "prNumber": 456,
  "startedAt": "2024-01-15T10:00:00Z",
  "logs": [
    {
      "timestamp": "2024-01-15T10:00:00Z",
      "level": "info",
      "message": "Starting code generation...",
      "metadata": {"file": "pkg/sql/executor.go"}
    }
  ]
}
```

### Cancel Agent Run
```http
POST /api/agents/{id}/cancel
```

**Response:**
```json
{
  "id": "uuid",
  "status": "cancelled",
  "cancelledAt": "2024-01-15T10:00:00Z"
}
```

### Stream Agent Logs (WebSocket)
```
WS /ws/agents/{id}
```

**Messages:**
```json
{
  "type": "log",
  "data": {
    "timestamp": "2024-01-15T10:00:00Z",
    "level": "info",
    "message": "Generated file: pkg/sql/executor.go",
    "metadata": {...}
  }
}
```

```json
{
  "type": "status_change",
  "data": {
    "status": "testing",
    "previousStatus": "coding"
  }
}
```

---

## Dashboard API

### Get Organization Dashboard
```http
GET /api/dashboard
```

**Response:**
```json
{
  "repos": [
    {
      "id": "uuid",
      "owner": "matrixorigin",
      "name": "matrixone",
      "openIssues": 150,
      "recentActivity": 12
    }
  ],
  "stats": {
    "totalOpenIssues": 350,
    "issuesByPriority": {
      "P0": 5,
      "P1": 25,
      "P2": 120,
      "P3": 200
    },
    "activeAgentRuns": 3,
    "blockers": 2
  },
  "recentActivity": [...],
  "blockers": [
    {
      "issueId": "uuid",
      "number": 123,
      "title": "Critical bug...",
      "reason": "Blocks release"
    }
  ]
}
```

### Get Activity Feed
```http
GET /api/activity?limit={n}&before={cursor}
```

**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "agent_completed",
      "title": "Agent completed issue #123",
      "description": "Successfully implemented feature X",
      "actor": {"id": "ai", "type": "ai"},
      "repoOwner": "matrixorigin",
      "repoName": "matrixone",
      "issueNumber": 123,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "cursor": "...",
  "hasMore": true
}
```

---

## GitHub Webhooks

### Receive Webhook
```http
POST /api/webhooks/github
X-GitHub-Event: issues
X-Hub-Signature-256: sha256=...
```

**Payload:** Standard GitHub webhook payload

**Response:**
```json
{
  "received": true,
  "eventId": "uuid",
  "processed": true
}
```

---

## Requirements API

### List Requirements
```http
GET /api/requirements?repositoryId={id}&stage={stage}&page={n}&limit={n}
```

**Response:**
```json
{
  "requirements": [
    {
      "id": "uuid",
      "title": "用户可以导出查询结果为 CSV",
      "stage": "breakdown",
      "createdBy": "pm-user",
      "issueCount": 3,
      "createdAt": "2026-03-01T08:00:00Z",
      "prdFinalizedAt": "2026-03-02T10:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

### Create Requirement
```http
POST /api/requirements
```

**Request:**
```json
{
  "title": "用户可以导出查询结果为 CSV",
  "description": "作为数据分析师，我需要能把查询结果下载为 CSV，方便在 Excel 中做进一步分析。",
  "repositoryId": "uuid"
}
```

**Response (`201`):**
```json
{
  "id": "uuid",
  "title": "...",
  "stage": "discovery",
  "createdAt": "2026-03-05T09:00:00Z"
}
```

### Get Requirement
```http
GET /api/requirements/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "...",
  "description": "...",
  "stage": "prd",
  "prdDocument": "## 背景与目标\n...",
  "issueCount": 3,
  "issues": [
    { "id": "uuid", "number": 42, "title": "实现 CSV 导出 API" }
  ],
  "createdBy": "pm-user",
  "createdAt": "...",
  "prdFinalizedAt": "..."
}
```

### Update Requirement Stage
```http
PATCH /api/requirements/{id}
```

**Request:**
```json
{
  "stage": "prd"
}
```

阶段流转必须单向，尝试回退返回 `400 INVALID_STAGE_TRANSITION`。

---

## Requirements PRD API

### Generate PRD（流式 SSE）
```http
POST /api/requirements/{id}/prd
```

触发 PRD Agent 生成结构化 PRD。流式返回 Server-Sent Events。

**Response (SSE stream):**
```
data: {"type":"start","message":"正在分析代码库..."}

data: {"type":"chunk","content":"## 背景与目标\n\n当前平台..."}

data: {"type":"chunk","content":"## 用户故事\n\n..."}

data: {"type":"done","documentLength":2048}
```

生成完成后 PRD 写入 requirement.prdDocument，stage 保持 `discovery`（不自动推进）。

**Error Codes:**
- `PRD_ALREADY_GENERATING` (409) — PRD 正在生成中，禁止重复触发
- `REQUIREMENT_WRONG_STAGE` (400) — 不在 discovery 阶段

### Finalize PRD
```http
POST /api/requirements/{id}/prd/finalize
```

人工确认 PRD，将 stage 推进到 `prd`，记录 `prdFinalizedAt`。

**Response:**
```json
{
  "id": "uuid",
  "stage": "prd",
  "prdFinalizedAt": "2026-03-05T10:30:00Z"
}
```

---

## Requirements Breakdown API

### Generate Issues Preview（技术拆解）
```http
POST /api/requirements/{id}/breakdown
```

调用技术拆解 Agent，读取 PRD，生成 Issue 列表预览。仅预览，**不写入 DB 也不推送 GitHub**。

**Response:**
```json
{
  "issues": [
    {
      "title": "实现 CSV 导出 API（/api/export/csv）",
      "body": "## 目标\n...\n## 实现思路\n...",
      "estimatedComplexity": "medium",
      "estimatedHours": 8,
      "dependencies": [],
      "labels": ["feature", "backend"],
      "duplicateWarning": null
    },
    {
      "title": "前端导出按钮与进度提示",
      "body": "...",
      "estimatedComplexity": "small",
      "estimatedHours": 4,
      "dependencies": ["实现 CSV 导出 API"],
      "labels": ["feature", "frontend"],
      "duplicateWarning": "与 issue #38「数据导出」标题相似度 82%，请确认"
    }
  ]
}
```

### Confirm Issues（确认批量创建）
```http
POST /api/requirements/{id}/breakdown/confirm
```

工程师确认预览后，批量写入 DB + 推送到 GitHub，stage → `breakdown`。

**Request:**
```json
{
  "issues": [
    {
      "title": "...",
      "body": "...",
      "labels": ["feature", "backend"]
    }
  ]
}
```

**Response:**
```json
{
  "created": [
    { "id": "uuid", "githubNumber": 42, "title": "..." }
  ],
  "stage": "breakdown",
  "issuesCreatedAt": "2026-03-05T11:00:00Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ISSUE_NOT_FOUND",
    "message": "Issue not found",
    "details": {...}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `ISSUE_NOT_FOUND` | 404 | Issue does not exist |
| `REQUIREMENT_NOT_FOUND` | 404 | Requirement does not exist |
| `AGENT_RUNNING` | 409 | Agent already running for issue |
| `PRD_ALREADY_GENERATING` | 409 | PRD 正在生成中 |
| `REQUIREMENT_WRONG_STAGE` | 400 | 需求当前 stage 不允许此操作 |
| `INVALID_STAGE_TRANSITION` | 400 | Stage 流转方向不合法 |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

- Authenticated requests: 1000/hour
- Webhook processing: 100/minute per repo
- AI analysis: 10/minute per user
