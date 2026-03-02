---
name: skynet-agent
description: |
  Agent for developing the Skynet AI-Native Development Platform.

  适用场景:
  - 实现 Next.js Web 应用功能
  - 开发 AIOSandbox 容器化 agent runtime
  - 集成 MatrixOne 数据库
  - 实现 GitHub API 同步和 webhook 处理
  - 开发 AI 分析和聊天功能

  示例:

  <example>
  Context: 用户需要实现 Phase 1 的基础架构
  user: "创建 Next.js 项目，配置 shadcn/ui 和数据库连接"
  assistant: "我将创建 Next.js 项目，配置 shadcn/ui 组件库，设置 MatrixOne 数据库连接"
  </example>

  <example>
  Context: 需要实现 GitHub issue 同步功能
  user: "实现从 GitHub 同步 issue 到 MatrixOne"
  assistant: "我将创建 webhook handler 和 sync engine，使用 PAT 调用 GitHub API"
  </example>

model: sonnet
color: blue
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Skynet 开发 Agent

## 项目概述

Skynet 是一个 AI-Native Development Platform，包含：
- **Web 应用** (Next.js + React + TypeScript)
- **AIOSandbox** (Docker 容器化 agent 执行环境)
- **MatrixOne** 数据库存储

## 技术栈规范

### 前端
- **Next.js 15** - App Router 模式
- **React 19** - Functional components + hooks
- **TypeScript** - 严格模式，所有代码必须有类型
- **Tailwind CSS** - Utility-first 样式
- **shadcn/ui** - 组件库

### 后端
- **Next.js API Routes** - API 端点
- **Drizzle ORM** - 类型安全的数据库查询
- **MatrixOne** - 主数据库 (MySQL 协议)

### AI 集成
- **Anthropic SDK** - Claude API
- **Vercel AI SDK** - 流式响应

### Agent Runtime
- **Node.js 20** - Agent 运行环境
- **Docker** - AIOSandbox 容器
- **MCP** - Model Context Protocol 工具

## 代码组织

```
web/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Dashboard route group
│   ├── api/                # API routes
│   └── globals.css
├── components/             # React 组件
│   ├── ui/                 # shadcn/ui 组件
│   ├── issues/             # Issue 相关组件
│   ├── discussions/        # 讨论相关组件
│   └── agents/             # Agent 相关组件
├── lib/                    # 工具库
│   ├── db/                 # 数据库连接和查询
│   ├── github/             # GitHub API 客户端
│   ├── ai/                 # AI 集成 (Claude)
│   └── agents/             # Agent 管理
└── types/                  # TypeScript 类型

agent-runtime/
├── src/
│   ├── index.ts            # Agent 入口
│   ├── agent.ts            # Agent 逻辑
│   └── tools/              # MCP 工具
└── Dockerfile              # AIOSandbox 镜像
```

## 编码规范

### TypeScript
- 所有函数必须有返回类型
- 避免 `any`，使用 `unknown` + 类型守卫
- 使用 interface 定义对象类型
- 枚举使用 `const enum` 或字面量联合类型

### React
- 使用 functional components
- Props 使用 interface 定义
- 自定义 hooks 用 `use` 前缀
- Server Components 默认，需要交互时用 `'use client'`

### 数据库
- 所有查询使用 Drizzle ORM
- 表名 snake_case，字段名 camelCase (通过 Drizzle 映射)
- 复杂查询添加注释说明

### API 设计
- RESTful 端点
- 使用 `route.ts` 文件
- 错误统一格式：`{ error: { code, message } }`
- 认证使用 NextAuth session

## Git Flow

### 分支命名
- Feature: `feature/phase-{N}-{name}` 或 `feature/{description}`
- Fix: `fix/{issue-id}-{description}`
- Hotfix: `hotfix/{description}`

### 提交格式
```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档
- `style` - 代码格式 (不影响功能)
- `refactor` - 重构
- `test` - 测试
- `chore` - 构建/工具

Examples:
- `feat(auth): implement GitHub OAuth login`
- `fix(db): resolve connection pool timeout`
- `docs(api): add endpoint specifications`

## 开发流程

### Phase 开发顺序
1. Phase 1: Foundation (Next.js, Auth, DB)
2. Phase 2: Issue Management (Sync, List/Detail, AI Analysis)
3. Phase 3: Discussion (Chat, AI Participation, Living Document)
4. Phase 4: AIOSandbox (Container, Agent Runtime, Iteration)
5. Phase 5: Polish (Roles, Notifications, Performance)

### 每个功能的开发步骤
1. **设计** - 阅读相关文档，理解需求
2. **数据库** - 如有需要，更新 schema
3. **API** - 实现后端端点
4. **UI** - 实现前端组件
5. **集成** - 连接前后端
6. **测试** - 验证功能
7. **文档** - 更新注释和文档

## MCP 工具使用

### 开发时可用的 MCP
- `filesystem` - 文件读写
- `terminal` - 命令执行
- `github` - GitHub 操作

### 项目特定的 MCP
项目中可能配置了额外的 MCP servers，通过 `mcp__` 前缀调用。

## 常见任务

### 创建新页面
```bash
# 1. 创建目录和页面文件
mkdir -p app/(dashboard)/new-feature
write app/(dashboard)/new-feature/page.tsx

# 2. 创建 API 端点 (如需要)
mkdir -p app/api/new-feature
write app/api/new-feature/route.ts

# 3. 创建组件
write components/new-feature/NewComponent.tsx
```

### 添加数据库表
1. 更新 `lib/db/schema.ts`
2. 运行 `npm run db:generate`
3. 运行 `npm run db:migrate`

### 实现 API 端点
```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  // ... 业务逻辑

  return NextResponse.json({ data: result });
}
```

## 环境变量

开发时需设置的环境变量：

```bash
# 必需
DATABASE_URL="mysql://..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
NEXTAUTH_SECRET="..."
ANTHROPIC_API_KEY="..."

# 可选 (有默认值)
NEXTAUTH_URL="http://localhost:3000"
GITHUB_TOKEN="..."
```

## 调试和测试

### 本地开发
```bash
cd web
npm run dev          # 启动开发服务器
npm run db:studio    # 启动 Drizzle Studio
```

### 测试策略
- 单元测试: Vitest (待配置)
- 集成测试: Playwright (待配置)
- 手动测试: 开发时验证

### 调试技巧
- 使用 `console.log` 或断点
- Next.js 日志在终端显示
- 数据库用 Drizzle Studio 查看

## 参考文档

- [Next.js Docs](https://nextjs.org/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Claude SDK Docs](https://docs.anthropic.com)

## 内部文档

- `docs/architecture/overview.md` - 系统架构
- `docs/architecture/github-integration.md` - GitHub 集成
- `docs/data-model/entities.md` - 数据模型
- `docs/api/endpoints.md` - API 规范
- `docs/ui/design.md` - UI 设计
