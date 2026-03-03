# Skynet

AI-Native Development Platform that enables cross-functional teams (PMs, engineers, designers, operators) to collaborate around GitHub issues with AI assistance.

## What it does

- **GitHub Issue Sync** -- Connects to GitHub repos via PAT + webhook, syncs issues in real-time
- **AI Issue Analysis** -- Classifies issues by type (bug/feature/task/question), priority (P0-P3), generates summaries and tags via Kimi (Moonshot)
- **Team Discussion** -- Chat interface per issue with streaming AI responses, living document synthesis, and one-way finalization
- **Dashboard** -- Real-time stats on open/closed issues, priority breakdown, activity feed

## Architecture

```
skynet/
├── apps/
│   ├── web/                  # Next.js 15 app (frontend + API)
│   │   ├── app/              # App Router pages + API routes
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Server utilities (ai, auth, github)
│   └── agent-runtime/        # Agent runtime for AIOSandbox (future)
├── packages/
│   ├── db/                   # Drizzle ORM schema + query functions
│   ├── sdk/                  # Shared contracts and types
│   ├── config/               # Shared configuration
│   └── ui/                   # Shared UI components (future)
├── docs/                     # Design documentation
└── references/
    └── issue-manager/        # Legacy Python issue manager
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | MatrixOne (MySQL wire protocol) |
| AI | Kimi/Moonshot (OpenAI-compatible API via `openai` package) |
| Auth | GitHub OAuth + JWT sessions (`jose`) |
| Monorepo | pnpm workspaces + Turborepo |

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10
- **MatrixOne** running locally (port 6001)
- **Moonshot API key** from [platform.moonshot.cn](https://platform.moonshot.cn)
- **GitHub OAuth App** + **Personal Access Token**

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create `apps/web/.env` (or symlink from root `.env`):

```bash
# Database (MatrixOne)
MATRIXONE_URL="mysql://root:111@127.0.0.1:6001/skynet"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"

# JWT
JWT_SECRET="a-strong-random-secret"

# GitHub (for API calls + webhooks)
GITHUB_TOKEN="ghp_your_personal_access_token"
GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# AI (Moonshot/Kimi)
MOONSHOT_API_KEY="sk-your-moonshot-api-key"
```

### 3. Create database and tables

```bash
# Create the database
mysql -h 127.0.0.1 -P 6001 -u root -p111 -e "CREATE DATABASE IF NOT EXISTS skynet;"

# Apply schema (use db:push since drizzle-kit migrate has MO compatibility issues)
pnpm --filter @skynet/db db:push
```

If `db:push` fails, apply the migration SQL manually:

```bash
sed 's/--> statement-breakpoint/;/g' packages/db/drizzle/0000_shocking_thena.sql > /tmp/init.sql
sed -i 's/CREATE TABLE `/CREATE TABLE IF NOT EXISTS `/g' /tmp/init.sql
mysql -h 127.0.0.1 -P 6001 -u root -p111 skynet < /tmp/init.sql

# Sprint 3 migration (finalized columns)
mysql -h 127.0.0.1 -P 6001 -u root -p111 skynet -e "
  ALTER TABLE discussions ADD finalized boolean DEFAULT false NOT NULL;
  ALTER TABLE discussions ADD finalized_at timestamp;
"
```

### 4. Start development

```bash
pnpm dev                          # All packages (via Turborepo)
# or
pnpm --filter @skynet/web dev     # Web app only
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

### Login

Visit the home page and click **Sign in with GitHub**. This initiates GitHub OAuth and creates a session.

For development without GitHub OAuth, POST to `/api/auth/token` to bootstrap a session:

```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"sub":"dev-user","username":"developer","role":"engineer"}'
```

### Connect a Repository

```bash
TOKEN="your-jwt-token"

# Onboard
curl -X POST http://localhost:3000/api/repositories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"owner":"your-org","name":"your-repo"}'

# Sync all issues
curl -X POST http://localhost:3000/api/repositories/<repo-id>/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"owner":"your-org","name":"your-repo"}'
```

### Set Up GitHub Webhook (real-time sync)

In your GitHub repo **Settings > Webhooks**:

| Field | Value |
|-------|-------|
| Payload URL | `https://your-domain/api/webhooks/github` |
| Content type | `application/json` |
| Secret | Same as `GITHUB_WEBHOOK_SECRET` |
| Events | **Issues** |

### Workflow

1. **Dashboard** (`/dashboard`) -- View stats and activity feed
2. **Issues** (`/issues`) -- Browse issues with filters (state, AI type, priority)
3. **Issue Detail** (`/issues/<id>`) -- View issue body, labels, click **Analyze** for AI classification
4. **Discussion** (`/issues/<id>/discussion`) -- Chat with AI about the issue, living document auto-updates in the sidebar
5. **Finalize** -- Lock the discussion and produce a final planning document

## API Routes

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/token` | No | Issue JWT session |
| GET | `/api/auth/github/callback` | No | GitHub OAuth callback |
| POST | `/api/auth/logout` | No | Clear session |

### Issues
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/issues` | Yes | List issues (params: `page`, `limit`, `state`, `ai_type`, `ai_priority`, `repo_owner`, `repo_name`) |
| GET | `/api/issues/:id` | Yes | Issue detail |
| POST | `/api/issues/:id/analyze` | Yes | Trigger AI analysis via Kimi |

### Discussion
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/issues/:id/discussion` | Yes | Get/create discussion + messages |
| POST | `/api/issues/:id/discussion/messages` | Yes | Post user message |
| POST | `/api/issues/:id/discussion/ai-respond` | Yes | Streaming AI response (SSE) |
| POST | `/api/issues/:id/discussion/synthesize` | Yes | Manual document synthesis |
| POST | `/api/issues/:id/discussion/finalize` | Yes | Finalize discussion (irreversible) |

### Repositories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/repositories` | Yes | List connected repos |
| POST | `/api/repositories` | Yes | Onboard repo (body: `{owner, name}`) |
| POST | `/api/repositories/:id/sync` | Yes | Full issue sync (body: `{owner, name}`) |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/github` | Signature | GitHub webhook receiver |
| GET | `/api/activity` | Yes | Activity feed (params: `limit`, `before`) |
| GET | `/api/dashboard` | Yes | Dashboard stats |
| GET | `/api/health` | No | Health check |

## Database Schema

10 tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `users` | GitHub-authenticated users with roles |
| `repositories` | Connected GitHub repositories |
| `issues` | Synced issues with AI classification fields |
| `discussions` | One discussion per issue, with finalization state |
| `messages` | Chat messages (user + AI) per discussion |
| `activity_log` | Audit trail of all actions |
| `webhook_events` | GitHub webhook deduplication and tracking |
| `agent_runs` | AI agent execution records (Phase 4) |
| `code_context_cache` | Cached code snippets for AI context |
| `issue_embeddings` | Vector embeddings for semantic search |

### MatrixOne Compatibility

MatrixOne returns `boolean` columns as VARCHAR `"true"`/`"false"` instead of TINYINT `1`/`0`. The schema uses a custom `moBoolean` Drizzle type to handle this transparently.

## AI Integration

Uses **Moonshot/Kimi** via the `openai` npm package with `baseURL: https://api.moonshot.cn/v1`.

| Use Case | Model | Context |
|----------|-------|---------|
| Issue analysis | `moonshot-v1-32k` | Single issue classification |
| Chat responses | `moonshot-v1-128k` | 50 messages + document + issue body |
| Document synthesis | `moonshot-v1-32k` | All messages + current document |

## Development

```bash
pnpm typecheck          # Type check all packages
pnpm test               # Run all tests (53 tests)
pnpm lint               # Lint web app
pnpm --filter @skynet/db db:generate   # Generate migration after schema changes
```

### Commit Convention

```
type(scope): subject
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Implementation Status

### Sprint 1 (Complete)
- [x] Monorepo scaffold (pnpm + Turborepo)
- [x] Next.js 15 app with App Router
- [x] MatrixOne database connection + Drizzle ORM
- [x] Full 10-table schema with migration
- [x] GitHub OAuth login/logout
- [x] JWT session management
- [x] `withAuth` middleware
- [x] Health check endpoint

### Sprint 2 (Complete)
- [x] Moonshot/Kimi AI client integration
- [x] AI issue analysis (type, priority, summary, tags)
- [x] GitHub API client (fetch + PAT)
- [x] Webhook receiver with HMAC-SHA256 verification
- [x] Full repository issue sync
- [x] Issue list page with filters and pagination
- [x] Issue detail page with AI analysis panel
- [x] Dashboard with real stats and activity feed
- [x] Repository onboarding API

### Sprint 3 (Complete)
- [x] Discussion system (one per issue)
- [x] Streaming AI chat via SSE
- [x] Living document auto-synthesis (every 3+ messages)
- [x] Manual synthesis refresh
- [x] One-way discussion finalization
- [x] Discussion UI (60/40 chat/document split)

### Sprint 4 (Planned)
- [ ] AIOSandbox agent runtime
- [ ] Implementation plan generation
- [ ] Sandboxed code generation
- [ ] PR creation from agent output

### Sprint 5 (Planned)
- [ ] Role-based views
- [ ] Notifications
- [ ] Performance optimization
- [ ] Onboarding flow

## License

Private repository.
