# Project Structure

## Repository Layout

```text
skynet/
├── apps/
│   ├── web/                           # Next.js Web Application
│   │   ├── app/                       # Next.js App Router
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── repos/
│   │   │   │   │   └── [owner]/
│   │   │   │   │       └── [name]/
│   │   │   │   │           ├── page.tsx
│   │   │   │   │           └── issues/
│   │   │   │   │               └── [number]/
│   │   │   │   │                   ├── page.tsx
│   │   │   │   │                   └── discussion/
│   │   │   │   │                       └── page.tsx
│   │   │   │   └── agents/
│   │   │   │       └── page.tsx
│   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── github/
│   │   │   │   │   │   └── callback/
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   └── refresh/
│   │   │   │   │       └── route.ts
│   │   │   │   ├── issues/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── route.ts
│   │   │   │   │       ├── analyze/
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       ├── code-context/
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       └── discussion/
│   │   │   │   │           ├── route.ts
│   │   │   │   │           ├── messages/
│   │   │   │   │           │   └── route.ts
│   │   │   │   │           └── finalize/
│   │   │   │   │               └── route.ts
│   │   │   │   ├── agents/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── route.ts
│   │   │   │   │       ├── cancel/
│   │   │   │   │       │   └── route.ts
│   │   │   │   │       └── logs/
│   │   │   │   │           └── route.ts
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── activity/
│   │   │   │   │   └── route.ts
│   │   │   │   └── webhooks/
│   │   │   │       └── github/
│   │   │   │           └── route.ts
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── types/
│   │   │   └── package.json
│   │   └── README.md
│   └── agent-runtime/                 # AIOSandbox agent runtime
│       ├── src/
│       │   ├── index.ts
│       │   ├── agent.ts
│       │   ├── plan-generator.ts
│       │   ├── code-generator.ts
│       │   ├── test-runner.ts
│       │   ├── git-operations.ts
│       │   ├── tools/
│       │   └── mcp/
│       └── package.json
├── packages/
│   ├── config/                        # Shared build/runtime config
│   ├── db/                            # Drizzle schema, migrations, db client
│   ├── sdk/                           # Shared API/domain types and clients
│   └── ui/                            # Shared UI primitives/design tokens
├── docs/
├── references/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Key Responsibilities

### apps/web

- UI routes and pages
- API routes (auth, issues, discussion, agents, webhook)
- WebSocket bridge and realtime status rendering

### apps/agent-runtime

- AIOSandbox runtime loop
- MCP tool invocation
- Lint/test/build iteration policy
- Branch/commit/PR automation

### packages/db

- DB schema and migrations
- Query layer reused by web APIs

### packages/sdk

- Shared request/response types
- Internal API clients and validation schemas

### packages/ui

- Reusable UI components and theme tokens

## Environment Configuration

### apps/web/.env.local

```bash
# Database
DATABASE_URL="mysql://username:password@host:port/database"

# Auth
GITHUB_CLIENT_ID="your-github-app-id"
GITHUB_CLIENT_SECRET="your-github-app-secret"
JWT_SECRET="random-secret-key"

# AI
ANTHROPIC_API_KEY="your-anthropic-api-key"

# App
APP_URL="http://localhost:3000"
GITHUB_WEBHOOK_SECRET="webhook-signing-secret"
REDIS_URL="redis://localhost:6379"
```

### apps/agent-runtime/.env

```bash
API_URL="http://localhost:3000"
API_TOKEN="agent-api-token"
GITHUB_TOKEN="github-personal-access-token"
GIT_USER_NAME="Agent"
GIT_USER_EMAIL="agent@example.com"
WORKSPACE_DIR="/tmp/agent-workspace"
```

## Naming Conventions

- Apps: `apps/<deployable-app>`
- Shared code: `packages/<domain>`
- API routes: `route.ts`
- DB tables/columns: `snake_case`
- TypeScript interfaces/types: `PascalCase`
