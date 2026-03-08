# Documentation Index

Complete documentation for the AI-Native Development Platform MVP.

## Quick Start

- **[README.md](README.md)** - Project overview and vision
- **[Implementation Phases](implementation/phases.md)** - 5-phase development roadmap

## Architecture

| Document | Description |
|----------|-------------|
| [architecture/overview.md](architecture/overview.md) | High-level system architecture, data flow, AIOSandbox integration |
| [architecture/github-integration.md](architecture/github-integration.md) | GitHub PAT + Webhook integration scheme |
| [architecture/ai-behavior.md](architecture/ai-behavior.md) | AI participation rules and behavior specification |
| [architecture/engineering-principles.md](architecture/engineering-principles.md) | Long-term engineering principles and governance |
| [architecture/project-structure.md](architecture/project-structure.md) | File organization and project layout |
| [architecture/rules-files.md](architecture/rules-files.md) | AGENTS.md and rules file structure (Claude Code skills pattern) |
| [architecture/openclaw-nanoclaw-evaluation.md](architecture/openclaw-nanoclaw-evaluation.md) | NanoClaw/OpenClaw discussion draft: observe-act loops and feedback UI |
| [architecture/adr/0001-workspace-monorepo.md](architecture/adr/0001-workspace-monorepo.md) | ADR: workspace monorepo layout |

## Data Model

| Document | Description |
|----------|-------------|
| [data-model/entities.md](data-model/entities.md) | TypeScript entity definitions |
| [data-model/schema.sql](data-model/schema.sql) | MatrixOne database schema |

## API

| Document | Description |
|----------|-------------|
| [api/endpoints.md](api/endpoints.md) | REST API and WebSocket specifications |

## UI/UX

| Document | Description |
|----------|-------------|
| [ui/design.md](ui/design.md) | Design system, layouts, and component specs |

## Implementation

| Document | Description |
|----------|-------------|
| [implementation/phases.md](implementation/phases.md) | 10-week implementation roadmap |
| [implementation/tech-stack.md](implementation/tech-stack.md) | Technology choices and configuration |
| [implementation/development-plan.md](implementation/development-plan.md) | Design review findings + executable sprint plan |
| [implementation/implementation-readiness.md](implementation/implementation-readiness.md) | Implementation readiness checklist and execution rules |

## Documentation Map

```
docs/
├── README.md              # Start here
├── INDEX.md              # This file - navigation
├── architecture/
│   ├── overview.md       # System architecture
│   ├── ai-behavior.md    # AI behavior spec
│   ├── engineering-principles.md # Long-term engineering principles
│   ├── project-structure.md # File organization
│   ├── openclaw-nanoclaw-evaluation.md # Agent platform evaluation and migration options
│   └── adr/
│       └── 0001-workspace-monorepo.md
├── data-model/
│   ├── entities.md       # TypeScript types
│   └── schema.sql        # Database schema
├── api/
│   └── endpoints.md      # API specification
├── ui/
│   └── design.md         # UI/UX design
└── implementation/
    ├── phases.md         # Implementation roadmap
    ├── development-plan.md # Design review + execution plan
    ├── implementation-readiness.md # Readiness checklist
    └── tech-stack.md     # Technology stack
```

## Reading Order

### For Understanding the System
1. [README.md](README.md) - Overview
2. [architecture/overview.md](architecture/overview.md) - Architecture
3. [data-model/entities.md](data-model/entities.md) - Data model
4. [architecture/ai-behavior.md](architecture/ai-behavior.md) - AI behavior

### For Implementation
1. [implementation/phases.md](implementation/phases.md) - Roadmap
2. [implementation/development-plan.md](implementation/development-plan.md) - Execution plan
3. [implementation/implementation-readiness.md](implementation/implementation-readiness.md) - Readiness
4. [implementation/tech-stack.md](implementation/tech-stack.md) - Stack
5. [architecture/project-structure.md](architecture/project-structure.md) - Structure
6. [api/endpoints.md](api/endpoints.md) - API design
7. [ui/design.md](ui/design.md) - UI specs

## Key Decisions Documented

| Decision | Location |
|----------|----------|
| Next.js 15 + App Router | [tech-stack.md](implementation/tech-stack.md) |
| Workspace monorepo (`apps/*`, `packages/*`) | [project-structure.md](architecture/project-structure.md) |
| MatrixOne database | [overview.md](architecture/overview.md) |
| AIOSandbox execution | [overview.md](architecture/overview.md) |
| AI as active participant | [ai-behavior.md](architecture/ai-behavior.md) |
| Living document pattern | [ai-behavior.md](architecture/ai-behavior.md) |
| 5-phase implementation | [phases.md](implementation/phases.md) |

## MVP Scope

The MVP (Phases 1-2 of the full 5-phase plan) includes:

1. **Issue Selection** → AI researches related code → provides background
2. **Issue Sync** → GitHub webhook + incremental sync into MatrixOne
3. **Issue Management** → list/detail/filter/search with AI summary
4. **Operational Visibility** → dashboard stats + activity feed

See [phases.md](implementation/phases.md) for full details.
