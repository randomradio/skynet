# GitHub 集成方案

## 方案选择: Personal Access Token (PAT)

基于现有资源和简化部署，采用 **PAT + Webhook** 方案。

## 架构对比

| 特性 | GitHub App (推荐长期) | PAT (MVP 适用) |
|------|----------------------|----------------|
| **设置复杂度** | 高 (需注册 App，配置权限) | 低 (生成 token 即可) |
| **权限粒度** | 细粒度 (per-repo 授权) | 粗粒度 (token 级别) |
| **Rate Limit** | 15,000/hour (per installation) | 5,000/hour (per token) |
| **Webhook 安全** | 内置签名验证 | 需手动配置 secret |
| **多用户** | 支持 (每个用户安装) | 单用户 |
| **适用场景** | 产品化、多组织 | MVP、内部使用 |

## PAT 方案详情

### Token 类型选择

**推荐: Fine-grained Personal Access Token**

```
Settings → Developer settings → Personal access tokens → Fine-grained tokens
```

**权限配置:**

| Scope | 权限 | 用途 |
|-------|------|------|
| Repository access | Select repositories | 指定可访问的仓库 |
| Contents | Read and write | 代码读写、分支管理 |
| Issues | Read and write | Issue 同步、评论 |
| Pull requests | Read and write | PR 创建、更新 |
| Metadata | Read | 基础仓库信息 |
| Commit statuses | Read | CI 状态检查 |
| Actions | Read | 工作流状态 |

**经典 Token (Classic PAT) 备选:**
- `repo` - 完整仓库访问
- `workflow` - 工作流管理

### Webhook 配置

由于使用 PAT，需要手动配置 Webhook：

**1. 在 GitHub 仓库设置 Webhook:**

```
Repository → Settings → Webhooks → Add webhook
```

**Payload URL:**
```
https://your-platform.com/api/webhooks/github
```

**Content type:** `application/json`

**Secret:** 生成随机字符串 (用于签名验证)

**Events:**
- [x] Issues
- [x] Issue comments
- [x] Pull requests
- [x] Pull request reviews
- [x] Pushes
- [ ] (可选) Workflow runs

**2. 平台环境变量:**

```bash
# .env.local
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

### 集成架构

```
┌─────────────────────────────────────────┐
│           GitHub.com                    │
│  ┌─────────────┐  ┌─────────────┐      │
│  │   Issues    │  │    PRs      │      │
│  └──────┬──────┘  └──────┬──────┘      │
│         │                │              │
│         └────────┬───────┘              │
│                  │ Webhook              │
└──────────────────┼──────────────────────┘
                   │ POST /api/webhooks/github
                   │ (signed with secret)
                   ▼
┌─────────────────────────────────────────┐
│     AI-Native Development Platform      │
│  ┌──────────────────────────────────┐   │
│  │        Webhook Handler           │   │
│  │  - Verify signature              │   │
│  │  - Parse payload                 │   │
│  │  - Queue for processing          │   │
│  └──────────────────────────────────┘   │
│                   │                     │
│                   ▼                     │
│  ┌──────────────────────────────────┐   │
│  │      GitHub API Client           │   │
│  │  - Uses PAT for auth             │   │
│  │  - Rate limit tracking           │   │
│  │  - Retry with backoff            │   │
│  └──────────────────────────────────┘   │
│                   │                     │
│                   ▼                     │
│  ┌──────────────────────────────────┐   │
│  │        Sync Engine               │   │
│  │  - Issue CRUD                    │   │
│  │  - Comment sync                  │   │
│  │  - PR status tracking            │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## API 调用模式

### 1.  Issue 同步

```typescript
// Platform → GitHub (using PAT)
class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';

  async getIssue(owner: string, repo: string, number: number): Promise<Issue> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/issues/${number}`,
      {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    return response.json();
  }

  async createComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<Comment> {
    // POST /repos/{owner}/{repo}/issues/{number}/comments
  }

  async createPullRequest(
    owner: string,
    repo: string,
    params: CreatePRParams
  ): Promise<PullRequest> {
    // POST /repos/{owner}/{repo}/pulls
  }
}
```

### 2. Webhook 处理

```typescript
// apps/web/app/api/webhooks/github/route.ts
import { verifyWebhookSignature } from '@/lib/github/webhooks';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  // 验证签名
  if (!verifyWebhookSignature(payload, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = request.headers.get('x-github-event');
  const data = JSON.parse(payload);

  switch (event) {
    case 'issues':
      await handleIssueEvent(data);
      break;
    case 'issue_comment':
      await handleCommentEvent(data);
      break;
    case 'pull_request':
      await handlePullRequestEvent(data);
      break;
    default:
      console.log(`Unhandled event: ${event}`);
  }

  return new Response('OK', { status: 200 });
}
```

### 3. 签名验证

```typescript
// lib/github/webhooks.ts
import { createHmac } from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest('hex')}`;

  return timingSafeEqual(digest, signature);
}
```

## Rate Limit 管理

### PAT Rate Limits

| Token Type | Limit | Reset |
|------------|-------|-------|
| Classic PAT | 5,000/hour | Per hour |
| Fine-grained PAT | 5,000/hour | Per hour |
| GitHub App | 15,000/hour | Per installation |

### 优化策略

```typescript
// lib/github/rate-limit.ts
class RateLimitManager {
  private remaining: number = 5000;
  private resetTime: Date = new Date();

  async checkLimit(): Promise<void> {
    if (this.remaining < 100) {
      const waitMs = this.resetTime.getTime() - Date.now();
      if (waitMs > 0) {
        throw new Error(`Rate limit exceeded. Reset in ${Math.ceil(waitMs / 1000)}s`);
      }
    }
  }

  updateFromHeaders(headers: Headers): void {
    this.remaining = parseInt(headers.get('x-ratelimit-remaining') || '0');
    const resetTimestamp = parseInt(headers.get('x-ratelimit-reset') || '0');
    this.resetTime = new Date(resetTimestamp * 1000);
  }
}
```

### 节流策略

1. **增量同步**: 只获取更新的 issues (使用 `since` 参数)
2. **Webhook 优先**: 实时更新靠 webhook，轮询作为备份
3. **批量操作**: 使用 GraphQL (v4 API) 减少请求数
4. **缓存**: 缓存 issue 内容，减少重复请求

## Webhook 事件处理

### 支持的事件

| Event | Action | 平台行为 |
|-------|--------|----------|
| `issues` | opened | 创建 issue，触发 AI 分析 |
| `issues` | closed | 更新 issue 状态 |
| `issues` | reopened | 更新 issue 状态 |
| `issues` | edited | 更新 title/body |
| `issue_comment` | created | 添加评论，AI 可能响应 |
| `issue_comment` | edited | 更新评论 |
| `pull_request` | opened | 关联到 issue |
| `pull_request` | closed | 更新 PR 状态 |
| `pull_request` | synchronize | PR 代码更新 |

### 幂等性处理

```typescript
// 使用 webhook delivery ID 去重
async function handleIssueEvent(data: WebhookPayload): Promise<void> {
  const deliveryId = data.delivery_id;

  // 检查是否已处理
  const existing = await db.webhookEvents.findUnique({
    where: { deliveryId },
  });

  if (existing) {
    console.log(`Event ${deliveryId} already processed`);
    return;
  }

  // 记录并处理
  await db.webhookEvents.create({
    data: {
      deliveryId,
      eventType: 'issues',
      payload: data,
    },
  });

  // 处理业务逻辑
  await syncIssue(data.repository.owner.login, data.repository.name, data.issue.number);
}
```

## 环境配置

```bash
# .env.local

# GitHub PAT (Fine-grained recommended)
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook secret (for signature verification)
GITHUB_WEBHOOK_SECRET=your-random-secret-string

# Optional: GitHub Enterprise
# GITHUB_API_URL=https://github.company.com/api/v3
```

## 安全注意事项

1. **Token 存储**: 使用环境变量，不提交到代码库
2. **Webhook Secret**: 使用随机字符串，定期轮换
3. **IP 白名单**: 生产环境可限制 GitHub webhook IPs
4. **最小权限**: Token 只授予必要权限
5. **Token 轮换**: 定期更新 PAT

## 迁移路径 (PAT → GitHub App)

未来如需迁移到 GitHub App:

1. 注册 GitHub App，配置相同权限
2. 安装 App 到仓库
3. 获取 Installation Token (代替 PAT)
4. 更新 API 调用使用 App authentication
5. 保留 Webhook 配置 (App 可使用相同 webhook URL)

代码变化最小，主要是认证方式改变。
