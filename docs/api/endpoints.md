# API Endpoints Specification

## Authentication

All API requests require authentication via GitHub OAuth JWT token.

```
Authorization: Bearer <jwt_token>
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
POST /api/discussions/{discussionId}/messages
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
POST /api/discussions/{discussionId}/finalize
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
| `AGENT_RUNNING` | 409 | Agent already running for issue |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

- Authenticated requests: 1000/hour
- Webhook processing: 100/minute per repo
- AI analysis: 10/minute per user
