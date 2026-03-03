# AI-Native Development Platform

## Overview

An AI-native development platform where cross-functional teams (PMs, engineers, designers, operators) collaborate around issues with AI assistance. The platform executes AI agents in AIOSandbox for isolated coding/testing while providing visibility to the entire team.

## Key Workflows

1. **Issue Creation & Triage**
   - PMs create issues with AI assistance (suggesting structure, finding duplicates)
   - AI analyzes issues, categorizes, finds related work, suggests approaches
   - Engineers review AI analysis, refine scope, assign to agents

2. **Issue → Code**
   - Engineers select issues and start implementation
   - AI generates implementation plans (AGENTS.md style)
   - Agents run in AIOSandbox isolated containers
   - CI/CD validates changes
   - Human review via the platform

3. **Cross-Functional Visibility**
   - Dashboard shows issues, blockers, agent activity
   - Everyone sees progress and context

## MVP Focus

The MVP (Phases 1-2) focuses on issue management foundation:

1. **Issue Selection** → AI researches related code → provides background
2. **Issue Sync** → GitHub webhook + incremental sync into MatrixOne
3. **Issue Management** → list/detail/filter/search with AI summary
4. **Operational Visibility** → dashboard stats + activity feed

## Documentation Structure

- [`/architecture`](architecture/) - System architecture and technical stack
- [`/data-model`](data-model/) - Database schema and entity definitions
- [`/api`](api/) - API specifications and endpoints
- [`/ui`](ui/) - UI/UX design and component specifications
- [`/implementation`](implementation/) - Implementation phases and milestones

## Repository Model

The repository uses a workspace monorepo layout:

- `apps/web` - Next.js product app
- `apps/agent-runtime` - AIOSandbox runtime
- `packages/*` - Shared libraries (db, sdk, ui, config)

## Quick Start

See [`/implementation/phases.md`](implementation/phases.md) for the implementation roadmap.
