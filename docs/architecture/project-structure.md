# Project Structure

## Repository Layout

```
skynet/
├── docs/                           # Documentation (you are here)
│   ├── README.md
│   ├── architecture/
│   ├── api/
│   ├── ui/
│   ├── data-model/
│   └── implementation/
│
├── web/                           # Next.js Web Application
│   ├── app/                       # Next.js App Router
│   │   ├── (dashboard)/           # Dashboard route group
│   │   │   ├── layout.tsx         # Dashboard layout
│   │   │   ├── page.tsx           # Org dashboard
│   │   │   ├── repos/
│   │   │   │   └── [owner]/
│   │   │   │       └── [name]/
│   │   │   │           ├── page.tsx           # Repo issues list
│   │   │   │           └── issues/
│   │   │   │               └── [number]/
│   │   │   │                   ├── page.tsx   # Issue detail
│   │   │   │                   └── discussion/
│   │   │   │                       └── page.tsx # Discussion view
│   │   │   └── agents/
│   │   │       └── page.tsx       # Agent control panel
│   │   ├── api/                   # API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts   # NextAuth configuration
│   │   │   ├── issues/
│   │   │   │   ├── route.ts       # List issues
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts   # Get/update issue
│   │   │   │       ├── analyze/
│   │   │   │       │   └── route.ts # Trigger AI analysis
│   │   │   │       └── code-context/
│   │   │   │           └── route.ts # Get related code
│   │   │   ├── discussions/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── messages/
│   │   │   │       │   └── route.ts
│   │   │   │       └── finalize/
│   │   │   │           └── route.ts
│   │   │   ├── agents/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── cancel/
│   │   │   │       │   └── route.ts
│   │   │   │       └── logs/
│   │   │   │           └── route.ts
│   │   │   ├── dashboard/
│   │   │   │   └── route.ts
│   │   │   ├── activity/
│   │   │   │   └── route.ts
│   │   │   └── webhooks/
│   │   │       └── github/
│   │   │           └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx               # Landing/login page
│   │
│   ├── components/                # React Components
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── issues/
│   │   │   ├── IssueCard.tsx
│   │   │   ├── IssueList.tsx
│   │   │   ├── IssueDetail.tsx
│   │   │   ├── AiAnalysisPanel.tsx
│   │   │   └── RelatedIssues.tsx
│   │   ├── discussions/
│   │   │   ├── DiscussionThread.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── LivingDocument.tsx
│   │   │   └── MessageInput.tsx
│   │   ├── agents/
│   │   │   ├── AgentStatusBadge.tsx
│   │   │   ├── AgentRunCard.tsx
│   │   │   ├── AgentLogViewer.tsx
│   │   │   └── AgentControlPanel.tsx
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx
│   │   │   ├── RepoCard.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   └── BlockerAlert.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── UserNav.tsx
│   │
│   ├── lib/                       # Utility libraries
│   │   ├── db/
│   │   │   ├── client.ts          # Database connection
│   │   │   ├── schema.ts          # Drizzle/Zod schema
│   │   │   └── queries.ts         # Query functions
│   │   ├── github/
│   │   │   ├── client.ts          # GitHub API client
│   │   │   ├── sync.ts            # Sync logic
│   │   │   └── webhooks.ts        # Webhook handlers
│   │   ├── ai/
│   │   │   ├── client.ts          # Anthropic SDK setup
│   │   │   ├── issue-analyzer.ts  # Issue analysis prompts
│   │   │   ├── chat-participant.ts # Discussion AI behavior
│   │   │   └── document-synthesizer.ts # Living document updates
│   │   ├── agents/
│   │   │   ├── manager.ts         # Agent lifecycle management
│   │   │   ├── runtime.ts         # Local agent execution
│   │   │   └── websocket.ts       # WebSocket handling
│   │   ├── mcp/
│   │   │   ├── client.ts          # MCP client
│   │   │   └── server.ts          # MCP server setup
│   │   ├── utils/
│   │   │   ├── cn.ts              # Tailwind merge
│   │   │   └── format.ts          # Formatting utilities
│   │   └── config.ts              # Environment config
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useIssues.ts           # TanStack Query hooks
│   │   ├── useDiscussion.ts
│   │   ├── useAgent.ts
│   │   └── useWebSocket.ts
│   │
│   ├── types/                     # TypeScript types
│   │   └── index.ts
│   │
│   ├── public/                    # Static assets
│   │
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── agent-runtime/                 # Local Agent Runtime (separate package)
│   ├── src/
│   │   ├── index.ts               # Entry point
│   │   ├── agent.ts               # Agent logic
│   │   ├── plan-generator.ts      # Implementation plan generation
│   │   ├── code-generator.ts      # Code generation
│   │   ├── test-runner.ts         # Test execution
│   │   ├── git-operations.ts      # Git commands
│   │   ├── tools/
│   │   │   ├── filesystem.ts
│   │   │   ├── github.ts
│   │   │   └── terminal.ts
│   │   └── mcp/
│   │       └── client.ts
│   ├── package.json
│   └── tsconfig.json
│
├── references/
│   └── issue-manager/             # Existing Python issue manager
│
└── docker-compose.yml             # For local development
```

## Key File Responsibilities

### Web Application

| File | Purpose |
|------|---------|
| `app/(dashboard)/layout.tsx` | Dashboard shell with sidebar |
| `app/(dashboard)/page.tsx` | Organization overview |
| `app/api/issues/route.ts` | Issue CRUD endpoints |
| `lib/db/client.ts` | MatrixOne connection pool |
| `lib/ai/issue-analyzer.ts` | AI analysis prompts |
| `lib/agents/runtime.ts` | Local agent spawning |

### Agent Runtime

| File | Purpose |
|------|---------|
| `src/agent.ts` | Main agent orchestration |
| `src/plan-generator.ts` | Generate implementation plans |
| `src/code-generator.ts` | Generate code from plans |
| `src/tools/filesystem.ts` | File system operations |

## Module Dependencies

```
┌─────────────────────────────────────────┐
│           Web Application               │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │   UI    │ │  Hooks  │ │   API    │  │
│  └────┬────┘ └────┬────┘ └────┬─────┘  │
│       └───────────┴───────────┘        │
│                   │                     │
│       ┌───────────┴───────────┐        │
│       ▼                       ▼        │
│  ┌─────────┐             ┌─────────┐   │
│  │   DB    │             │   AI    │   │
│  └────┬────┘             └────┬────┘   │
│       │                       │        │
│       ▼                       ▼        │
│  ┌─────────┐             ┌─────────┐   │
│  │MatrixOne│             │Anthropic│   │
│  └─────────┘             └─────────┘   │
└─────────────────────────────────────────┘
                   │
                   │ spawns
                   ▼
┌─────────────────────────────────────────┐
│         Agent Runtime                   │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │  Agent  │ │   MCP   │ │   Git    │  │
│  └────┬────┘ └────┬────┘ └────┬─────┘  │
│       └───────────┴───────────┘        │
│                   │                     │
│                   ▼                     │
│            ┌───────────┐                │
│            │ Local FS  │                │
│            │ GitHub    │                │
│            └───────────┘                │
└─────────────────────────────────────────┘
```

## Environment Configuration

### Web Application (.env.local)

```bash
# Database
DATABASE_URL="mysql://username:password@host:port/database"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-app-id"
GITHUB_CLIENT_SECRET="your-github-app-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random-secret-key"

# AI
ANTHROPIC_API_KEY="your-anthropic-api-key"

# WebSocket (for production)
REDIS_URL="redis://localhost:6379"  # Optional for MVP

# App Config
APP_URL="http://localhost:3000"
WEBHOOK_SECRET="webhook-signing-secret"
```

### Agent Runtime (.env)

```bash
# API connection
API_URL="http://localhost:3000"
API_TOKEN="agent-api-token"

# Git
GITHUB_TOKEN="github-personal-access-token"
GIT_USER_NAME="Agent"
GIT_USER_EMAIL="agent@example.com"

# Working directory
WORKSPACE_DIR="/tmp/agent-workspace"

# Optional: Docker
USE_DOCKER="false"
DOCKER_IMAGE="agent-runtime:latest"
```

## Naming Conventions

### Files
- Components: `PascalCase.tsx` (e.g., `IssueCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- API routes: `route.ts` (Next.js convention)
- Styles: `kebab-case.module.css`

### Database
- Tables: `snake_case` (e.g., `agent_runs`)
- Columns: `snake_case` (e.g., `started_at`)
- Foreign keys: `{table}_id` (e.g., `issue_id`)

### TypeScript
- Interfaces: `PascalCase` (e.g., `Issue`)
- Types: `PascalCase` with suffix (e.g., `IssueStatus`)
- Enums: `PascalCase` with suffix (e.g., `AgentStatus`)
- Constants: `SCREAMING_SNAKE_CASE`

## Import Organization

```typescript
// 1. External dependencies
import React from 'react';
import { NextRequest } from 'next/server';

// 2. Internal absolute imports
import { db } from '@/lib/db/client';
import { Button } from '@/components/ui/button';

// 3. Internal relative imports
import { IssueCard } from './IssueCard';
import { useIssues } from '../hooks/useIssues';
```
