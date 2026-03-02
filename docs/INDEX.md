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
| [architecture/project-structure.md](architecture/project-structure.md) | File organization and project layout |
| [architecture/rules-files.md](architecture/rules-files.md) | AGENTS.md and rules file structure (Claude Code skills pattern) |

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

## Documentation Map

```
docs/
├── README.md              # Start here
├── INDEX.md              # This file - navigation
├── architecture/
│   ├── overview.md       # System architecture
│   ├── ai-behavior.md    # AI behavior spec
│   └── project-structure.md # File organization
├── data-model/
│   ├── entities.md       # TypeScript types
│   └── schema.sql        # Database schema
├── api/
│   └── endpoints.md      # API specification
├── ui/
│   └── design.md         # UI/UX design
└── implementation/
    ├── phases.md         # Implementation roadmap
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
2. [implementation/tech-stack.md](implementation/tech-stack.md) - Stack
3. [architecture/project-structure.md](architecture/project-structure.md) - Structure
4. [api/endpoints.md](api/endpoints.md) - API design
5. [ui/design.md](ui/design.md) - UI specs

## Key Decisions Documented

| Decision | Location |
|----------|----------|
| Next.js 15 + App Router | [tech-stack.md](implementation/tech-stack.md) |
| MatrixOne database | [overview.md](architecture/overview.md) |
| Local agent execution | [overview.md](architecture/overview.md) |
| AI as active participant | [ai-behavior.md](architecture/ai-behavior.md) |
| Living document pattern | [ai-behavior.md](architecture/ai-behavior.md) |
| 5-phase implementation | [phases.md](implementation/phases.md) |

## MVP Scope

The MVP (Phases 1-2 of the full 5-phase plan) includes:

1. **Issue Selection** → AI researches related code → provides background
2. **Team Chat** → PM, designer, dev join → AI acts as judge, collecting info
3. **Living Document** → AI continuously updates final document or execution plan
4. **Handoff** → Ready for agent execution or human review

See [phases.md](implementation/phases.md) for full details.
