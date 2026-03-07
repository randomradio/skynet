# Skynet

AI-Native Development Platform that enables cross-functional teams (PMs, engineers, designers, operators) to collaborate around GitHub issues with AI assistance.

## What it does

- **GitHub Issue Sync** -- Connects to GitHub repos via PAT + webhook, syncs issues in real-time
- **AI Issue Analysis** -- Classifies issues by type (bug/feature/task/question), priority (P0-P3), generates summaries and tags via GLM (Anthropic-compatible API)
- **Team Discussion** -- Chat interface per issue with streaming AI responses, living document synthesis, and one-way finalization
- **AI Agent Runs** -- AI-powered implementation plan generation and code generation from issues, with real-time log streaming
- **Dashboard** -- Real-time stats on open/closed issues, priority breakdown, activity feed

## Architecture

```
skynet/
├── apps/
│   ├── web/                  # Next.js 15 app (frontend + API)
│   │   ├── app/              # App Router pages + API routes
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Server utilities (ai, auth, github, agent, sandbox)
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
| AI | GLM 4.7 (Anthropic-compatible endpoint) |
| Auth | GitHub OAuth + JWT sessions (`jose`) |
| Monorepo | pnpm workspaces + Turborepo |

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10
- **MatrixOne** running locally (port 6001)
- **Zhipu API key** for GLM 4.7
- **GitHub OAuth App** + **Personal Access Token**

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create `.env` at the project root and symlink it to `apps/web/.env`:

```bash
# Create the .env file at root
cat > .env << 'EOF'
# Database (MatrixOne via MySQL wire protocol)
DATABASE_URL="mysql://root:111@127.0.0.1:6001/skynet"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-oauth-app-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"

# JWT Session Secret
JWT_SECRET="a-strong-random-secret"

# GitHub PAT (for API calls + webhooks)
GITHUB_TOKEN="ghp_your_personal_access_token"
GITHUB_WEBHOOK_SECRET="your-webhook-secret"
GITHUB_OAUTH_TIMEOUT_MS="15000"

# AI (preferred: GLM via Anthropic-compatible endpoint)
ANTHROPIC_AUTH_TOKEN="your-zhipu-api-key"
ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
ANTHROPIC_DEFAULT_SONNET_MODEL="glm-4.7"
ANTHROPIC_DEFAULT_HAIKU_MODEL="glm-4.5-air"
ANTHROPIC_DEFAULT_OPUS_MODEL="glm-4.7"

# Skill hub (local editable folder)
SKILL_HUB_DIR=".skill-hub"

# NanoClaw runtime (required)
NANOCLAW_ROOT="/data/nanoclaw"
CONTEXT_BUNDLE_ROOT=".skynet-context"
SANDBOX_URL="http://localhost:8180"

# Auto-sync interval for issue/PR DB cache warmup
REPO_AUTO_SYNC_MIN_INTERVAL_MS="300000"
EOF

# Next.js reads .env from the app directory, so symlink it
ln -sf ../../.env apps/web/.env
```

See **[Credential Setup Guide](#credential-setup-guide)** below for how to obtain each value.

### 3. Create database and tables

```bash
# Create the database
mysql -h 127.0.0.1 -P 6001 -u root -p111 -e "CREATE DATABASE IF NOT EXISTS skynet;"

# Apply schema (use db:push since drizzle-kit migrate has MO compatibility issues)
DATABASE_URL="mysql://root:111@127.0.0.1:6001/skynet" pnpm --filter @skynet/db db:push
```

If `db:push` fails, apply the migration SQL manually:

```bash
sed 's/--> statement-breakpoint/;/g' packages/db/drizzle/0000_shocking_thena.sql > /tmp/init.sql
sed -i 's/CREATE TABLE `/CREATE TABLE IF NOT EXISTS `/g' /tmp/init.sql
mysql -h 127.0.0.1 -P 6001 -u root -p111 skynet < /tmp/init.sql
```

### 4. Start development

```bash
pnpm dev                          # All packages (via Turborepo)
# or
pnpm --filter @skynet/web dev     # Web app only
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run in Docker (optional)

```bash
docker compose up -d matrixone sandbox web
curl -sS http://localhost:3000/api/health
```

`docker-compose.yml` runs:
- `matrixone` on port `6001`
- `sandbox` on port `8180`
- `web` on port `3000`

For container networking, use:
- `DATABASE_URL_DOCKER` (default `mysql://root:111@matrixone:6001/skynet`)
- `SANDBOX_URL_DOCKER` (default `http://sandbox:8080`)

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

### Start an Agent Run

From the issue detail page, click **Start Implementation**. The agent will:
1. Generate an implementation plan using AI
2. Generate code changes based on the plan
3. Stream logs in real-time to the agent detail page

You can also start agent runs via API:

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"issueId":"<issue-uuid>","options":{"autoCreatePR":false}}'
```

### Workflow

1. **Dashboard** (`/dashboard`) -- View stats and activity feed
2. **Issues** (`/issues`) -- Browse issues with filters (state, AI type, priority)
3. **Issue Detail** (`/issues/<id>`) -- View issue body, labels, click **Analyze** for AI classification
4. **Discussion** (`/issues/<id>/discussion`) -- Chat with AI about the issue, living document auto-updates in the sidebar
5. **Finalize** -- Lock the discussion and produce a final planning document
6. **Start Implementation** -- Launch an AI agent to generate a plan and code
7. **Agent Detail** (`/agents/<id>`) -- Monitor agent progress with live log streaming

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
| POST | `/api/issues/:id/analyze` | Yes | Trigger AI analysis |
| POST | `/api/issues/:id/review` | Yes | Start issue review + handoff generation |
| POST | `/api/issues/:id/review/confirm` | Yes | Confirm/revise handoff and start development run |

### Discussion
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/issues/:id/discussion` | Yes | Get/create discussion + messages |
| POST | `/api/issues/:id/discussion/messages` | Yes | Post user message |
| POST | `/api/issues/:id/discussion/ai-respond` | Yes | Streaming AI response (SSE) |
| POST | `/api/issues/:id/discussion/synthesize` | Yes | Manual document synthesis |
| POST | `/api/issues/:id/discussion/finalize` | Yes | Finalize discussion (irreversible) |

### Agents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | Yes | List agent runs (params: `page`, `limit`, `status`, `issue_id`) |
| POST | `/api/agents` | Yes | Start agent run (body: `{issueId, options?}`) |
| GET | `/api/agents/:id` | Yes | Agent run detail (plan, logs, artifacts) |
| POST | `/api/agents/:id/cancel` | Yes | Cancel a running agent |
| GET | `/api/agents/:id/logs` | Yes | SSE stream of agent logs (real-time) |

### Skills
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/skills` | Yes | List loaded skill manifests |
| GET | `/api/skills/:skillId` | Yes | Get one skill manifest |
| POST | `/api/skills/reload` | Yes | Reload local skill hub manifests |

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
| `agent_runs` | AI agent execution records (plan, status, logs, artifacts) |
| `code_context_cache` | Cached code snippets for AI context |
| `issue_embeddings` | Vector embeddings for semantic search |

### MatrixOne Compatibility

MatrixOne returns `boolean` columns as VARCHAR `"true"`/`"false"` instead of TINYINT `1`/`0`. The schema uses a custom `moBoolean` Drizzle type to handle this transparently.

## AI Integration

Uses the OpenAI-compatible SDK with a model provider adapter:
- **GLM** via Z.AI Anthropic-compatible endpoint (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`)

| Use Case | Model | Context |
|----------|-------|---------|
| Fast path | `ANTHROPIC_DEFAULT_HAIKU_MODEL` (default `glm-4.5-air`) | Lightweight synthesis/extraction |
| Standard path | `ANTHROPIC_DEFAULT_SONNET_MODEL` (default `glm-4.7`) | Issue analysis, planning, reviews |
| Long path | `ANTHROPIC_DEFAULT_OPUS_MODEL` (default `glm-4.7`) | Long-context generation tasks |

## Agent System (Phase 4)

The agent system enables AI-powered implementation from GitHub issues:

### Agent Lifecycle

```
User clicks "Start Implementation" on issue detail page
    ↓
Planning: AI generates implementation plan (files, tests, approach)
    ↓
Coding: AI generates code for each planned file
    ↓
Testing: (placeholder — full lint/test execution loop not wired to runtime containers yet)
    ↓
Review: Artifacts ready for human review
    ↓
Complete/Failed: Terminal state with artifacts and logs
```

### Agent Status Machine

| Status | Description |
|--------|-------------|
| `planning` | Generating implementation plan via AI |
| `coding` | Generating code changes |
| `testing` | Running lint/test iterations (requires sandbox) |
| `review` | Awaiting human review |
| `completed` | Successfully completed |
| `failed` | Failed (see logs for details) |
| `cancelled` | Cancelled by user |

### Iteration Policy (for future AIOSandbox)

| Stage | Max Iterations | Auto-fix | On Failure |
|-------|----------------|----------|------------|
| Lint errors | 3 | Yes | Handoff to human |
| Type errors | 3 | Yes | Handoff to human |
| Local tests | 1 | No | Handoff to human |
| Build | 2 | Yes | Handoff to human |

## Development

```bash
pnpm typecheck          # Type check all packages
pnpm test               # Run all tests (60 tests)
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
- [x] GLM-first model client integration
- [x] AI issue analysis (type, priority, summary, tags)
- [x] GitHub API client (fetch + PAT)
- [x] Webhook receiver with HMAC-SHA256 verification
- [x] Full repository issue sync
- [x] Issue/PR read-through DB cache warmup (auto-sync on cache miss)
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

### Sprint 4 (Complete)
- [x] Agent run DB module (create, list, detail, cancel, logs)
- [x] AI implementation plan generation
- [x] AI code generation from plans
- [x] Agent execution engine with progress tracking
- [x] Agent API routes (CRUD + SSE log streaming)
- [x] Agent UI (list page, detail page with live logs)
- [x] "Start Implementation" button on issue detail
- [x] GitHub branch/PR creation utilities
- [x] Switched to `DATABASE_URL` (from `MATRIXONE_URL`)

### Sprint 5 (Planned)
- [ ] AIOSandbox Docker integration (isolated agent execution)
- [ ] Real lint/test iteration loops in sandbox
- [ ] Automatic PR creation from agent output
- [ ] Role-based views
- [ ] Notifications
- [ ] Performance optimization
- [ ] Onboarding flow

## Credential Setup Guide

### 1. DATABASE_URL (MatrixOne)

MatrixOne uses the MySQL wire protocol. Install and run MatrixOne locally:

```bash
# Default connection for local MatrixOne
DATABASE_URL="mysql://root:111@127.0.0.1:6001/skynet"
```

- **Host**: `127.0.0.1` (local) or your MatrixOne server IP
- **Port**: `6001` (MatrixOne default)
- **User/Password**: `root`/`111` (MatrixOne default)
- **Database**: `skynet` (created during setup)

### 2. JWT_SECRET

Used to sign and verify JWT session tokens. Generate a strong random string:

```bash
# Generate a 64-character random secret
openssl rand -base64 48
```

Set the output as your `JWT_SECRET`. This can be any strong random string (32+ characters recommended).

### 3. GitHub OAuth App (GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET)

1. Go to **GitHub Settings > Developer Settings > OAuth Apps > New OAuth App**
   - Or visit: https://github.com/settings/applications/new
2. Fill in:
   - **Application name**: `Skynet` (or any name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
3. Click **Register Application**
4. Copy the **Client ID** → `GITHUB_CLIENT_ID`
5. Click **Generate a new client secret** → copy it → `GITHUB_CLIENT_SECRET`

### 4. GITHUB_TOKEN (Personal Access Token)

Used for server-side GitHub API calls (fetching issues, creating branches/PRs):

1. Go to **GitHub Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens**
   - Or visit: https://github.com/settings/tokens?type=beta
2. Click **Generate new token**
3. Set:
   - **Token name**: `skynet-api`
   - **Expiration**: 90 days (or custom)
   - **Repository access**: Select repos you want to connect
   - **Permissions**:
     - **Issues**: Read and Write
     - **Contents**: Read and Write (for branch/PR creation)
     - **Pull requests**: Read and Write
     - **Metadata**: Read-only
4. Click **Generate token** → copy → `GITHUB_TOKEN`

### 5. GITHUB_WEBHOOK_SECRET

Used to verify GitHub webhook signatures (HMAC-SHA256):

```bash
# Generate a random webhook secret
openssl rand -hex 32
```

Set this as `GITHUB_WEBHOOK_SECRET` in `.env` AND in your GitHub repo webhook configuration.

### 6. ANTHROPIC_AUTH_TOKEN (GLM 4.7 via Anthropic-compatible API)

Used for AI issue analysis, chat, document synthesis, and agent plan/code generation.

1. Visit Zhipu BigModel platform and create an API key.
2. Copy the key into `ANTHROPIC_AUTH_TOKEN`.
3. Set `ANTHROPIC_BASE_URL` to `https://open.bigmodel.cn/api/anthropic`.
4. Set default models:
   - `ANTHROPIC_DEFAULT_SONNET_MODEL=glm-4.7`
   - `ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4.5-air`
   - `ANTHROPIC_DEFAULT_OPUS_MODEL=glm-4.7`

### Complete .env Example

```bash
# Database (MatrixOne)
DATABASE_URL="mysql://root:111@127.0.0.1:6001/skynet"

# GitHub OAuth App
GITHUB_CLIENT_ID="Ov23ct..."
GITHUB_CLIENT_SECRET="443b8f..."

# JWT Session Secret (generate with: openssl rand -base64 48)
JWT_SECRET="your-strong-random-secret-here"

# GitHub PAT (fine-grained token with Issues + Contents + PR permissions)
GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
GITHUB_OAUTH_TIMEOUT_MS="15000"

# GitHub Webhook Secret (generate with: openssl rand -hex 32)
GITHUB_WEBHOOK_SECRET="your-webhook-signing-secret"

# GLM 4.7 (Anthropic-compatible)
ANTHROPIC_AUTH_TOKEN="your-zhipu-api-key"
ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
ANTHROPIC_DEFAULT_SONNET_MODEL="glm-4.7"
ANTHROPIC_DEFAULT_HAIKU_MODEL="glm-4.5-air"
ANTHROPIC_DEFAULT_OPUS_MODEL="glm-4.7"

# Local skill hub
SKILL_HUB_DIR=".skill-hub"

# NanoClaw runtime (required)
NANOCLAW_ROOT="/data/nanoclaw"
CONTEXT_BUNDLE_ROOT=".skynet-context"
SANDBOX_URL="http://localhost:8180"

# Cache warmup and Docker overrides
REPO_AUTO_SYNC_MIN_INTERVAL_MS="300000"
DATABASE_URL_DOCKER="mysql://root:111@matrixone:6001/skynet"
SANDBOX_URL_DOCKER="http://sandbox:8080"
WEB_PORT="3000"
```

After creating `.env` at the project root, symlink it for Next.js:

```bash
ln -sf ../../.env apps/web/.env
```

## License

Private repository.
