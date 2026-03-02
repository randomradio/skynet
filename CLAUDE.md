# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Skynet** is an AI-Native Development Platform that enables cross-functional teams (PMs, engineers, designers, operators) to collaborate around GitHub issues with AI assistance. The platform provides AI-powered issue analysis, team discussion with living documents, and agent-based code generation.

### Legacy Component (Python)

The repository also contains a legacy Python-based GitHub Issue intelligent management system in `references/issue-manager/`.

## Quick Links

- [Documentation Index](docs/INDEX.md) - Complete design documentation
- [Architecture Overview](docs/architecture/overview.md) - System architecture
- [Implementation Phases](docs/implementation/phases.md) - Development roadmap
- [Tech Stack](docs/implementation/tech-stack.md) - Technology choices

## AI-Native Development Platform (New)

### Vision

An AI-native development platform where:
1. **PMs** create issues with AI assistance (suggesting structure, finding duplicates)
2. **AI** analyzes issues, categorizes, finds related work, suggests approaches
3. **Engineers** review AI analysis, refine scope, assign to agents
4. **AI agents** generate code in isolated AIOSandbox environments
5. **CI/CD** validates changes
6. **Human review** happens via the platform
7. **Cross-functional visibility** - everyone sees progress, blockers, context

### Project Structure

```
skynet/
├── docs/                    # Design documentation
├── web/                     # Next.js web application (Phase 1-5)
│   ├── app/                 # App Router pages
│   ├── components/          # React components
│   ├── lib/                 # Utilities (db, ai, agents)
│   └── hooks/               # Custom React hooks
├── agent-runtime/           # Agent runtime for AIOSandbox
└── references/
    └── issue-manager/       # Legacy Python code
```

### Core Workflows

**1. Issue Creation & Triage**
```
PM creates issue in UI
    ↓
AI analyzes: categorizes, finds duplicates, suggests labels
    ↓
Engineer reviews, refines, assigns priority
    ↓
Issue enters backlog with AI-generated summary
```

**2. Discussion & Living Document**
```
User selects issue
    ↓
AI fetches related code (vector search + keyword)
    ↓
AI posts initial context message
    ↓
Team joins discussion (PM, designer, dev)
    ↓
AI participates: answers questions, fetches code on demand
    ↓
AI continuously synthesizes into document/plan (visible sidebar)
    ↓
On "finalize": document/plan locked, ready for execution
```

**3. Issue → Code (via AIOSandbox)**
```
Engineer clicks "Start Implementation"
    ↓
Platform generates implementation plan
    ↓
AIOSandbox (Docker) provisioned
    ↓
Agent runs in isolated container:
    - Generate code
    - Run lint (auto-fix, max 3 iterations)
    - Run tests (1 attempt, then handoff)
    - Create branch, commit, push
    - Create PR
    ↓
Platform receives results via API
    ↓
Sandbox destroyed
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | MatrixOne (existing infrastructure) |
| AI | Anthropic Claude SDK, Vercel AI SDK |
| Auth | GitHub OAuth (NextAuth.js) |
| Agent Runtime | Docker containers (AIOSandbox) |
| Communication | HTTP API between Platform and Sandbox |
| Real-time | WebSocket for UI updates |

### Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 | Full-stack React, App Router, API routes |
| Database | MatrixOne | Existing infrastructure, MySQL protocol |
| AI Provider | Claude (Anthropic) | Strong reasoning, code generation |
| Auth | GitHub OAuth | Single sign-on, existing integration |
| Agent Execution | AIOSandbox (Docker) | Isolation, security, ephemeral environments |
| GitHub Integration | PAT + Webhook | Simple, sufficient for MVP |
| Rules System | AGENTS.md + modular rules | Based on Claude Code skills pattern |

### Git Flow Workflow

```
main (production)
  ↑
develop (integration)
  ↑
feature/phase-1-foundation
feature/phase-2-issues
...
```

Branch naming:
- Feature: `feature/phase-{N}-{name}` or `feature/{description}`
- Fix: `fix/{issue}-{description}`
- Hotfix: `hotfix/{description}`

Commit format: `type(scope): subject`
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Implementation Phases

| Phase | Duration | Focus | Key Deliverables |
|-------|----------|-------|------------------|
| **Phase 1** | Weeks 1-2 | Foundation | Next.js setup, MatrixOne connection, GitHub OAuth, basic dashboard |
| **Phase 2** | Weeks 3-4 | Issue Management | GitHub sync, issue list/detail views, AI analysis, activity feed |
| **Phase 3** | Weeks 5-6 | Discussion & Collaboration | Chat interface, AI participation, living document, finalization |
| **Phase 4** | Weeks 7-8 | AIOSandbox Runtime | Sandbox agent execution, MCP integration, iteration policy, PR creation |
| **Phase 5** | Weeks 9-10 | Integration & Polish | Role-based views, notifications, performance, onboarding |

### Environment Variables

```bash
# Database
DATABASE_URL="mysql://username:password@host:port/database"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-app-id"
GITHUB_CLIENT_SECRET="your-github-app-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random-secret-key"

# GitHub PAT (for API calls)
GITHUB_TOKEN="github_pat_xxxxxxxxxxxx"
GITHUB_WEBHOOK_SECRET="webhook-signing-secret"

# AI
ANTHROPIC_API_KEY="your-anthropic-api-key"

# App Config
APP_URL="http://localhost:3000"
```

### Iteration Policy (Agent Execution)

| Stage | Max Iterations | Auto-fix | On Failure |
|-------|----------------|----------|------------|
| Lint errors | 3 | Yes | Handoff to human |
| Type errors | 3 | Yes | Handoff to human |
| Local tests | 1 | No | Handoff to human |
| Build | 2 | Yes | Handoff to human |
| CI | 1 | Yes | Human review |

### MCP (Model Context Protocol)

Platform-side MCP servers:
- `github-search`: Search code in repository
- `vector-search`: Semantic code search

AIOSandbox-side MCP servers:
- `filesystem`: File operations (restricted to /workspace)
- `terminal`: Sandboxed command execution
- `github`: GitHub CLI operations

### Documentation Structure

See `docs/` directory for complete documentation:
- `architecture/` - System architecture, AI behavior, rules files
- `data-model/` - Entity definitions, database schema
- `api/` - API endpoint specifications
- `ui/` - UI/UX design system
- `implementation/` - Phases, tech stack

---

## Legacy Python Issue Manager

### Project Location

The main legacy project is located in: `references/issue-manager/`

All commands should be run from this directory unless otherwise specified.

### Common Commands

**Installation:**
```bash
cd references/issue-manager
pip3 install -r requirements.txt
```

**Running the Application:**
```bash
# Interactive mode
python3 run.py
# or
python3 main.py

# Auto-run with arguments
python3 auto_run.py --repo-owner matrixorigin --repo-name matrixone
```

### Legacy Architecture

| Module | Purpose |
|--------|---------|
| `github_collector/` | GitHub API integration |
| `llm_parser/` | AI-powered issue classification |
| `database_storage/` | Database abstraction (SQLite, PostgreSQL, MySQL, MatrixOne) |
| `report_generator/` | Daily reports and progress reports |
| `analysis_engine/` | Multi-dimensional analysis |
| `ai_analysis/` | AI-driven analysis for project progress |

### Key Dependencies

- `httpx` - HTTP client for GitHub API
- `sqlalchemy` + `pymysql` - Database access
- `anthropic` - Claude API client
- `dashscope` - Tongyi Qianwen SDK
