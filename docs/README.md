# AI-Native Development Platform

## Overview

An AI-native development platform where cross-functional teams (PMs, engineers, designers, operators) collaborate around issues with AI assistance. The platform enables AI agents to generate code locally on engineers' machines while providing visibility to the entire team.

## Key Workflows

1. **Issue Creation & Triage**
   - PMs create issues with AI assistance (suggesting structure, finding duplicates)
   - AI analyzes issues, categorizes, finds related work, suggests approaches
   - Engineers review AI analysis, refine scope, assign to agents

2. **Issue → Code**
   - Engineers select issues and start implementation
   - AI generates implementation plans (AGENTS.md style)
   - Agents spawn locally on engineer's machine
   - CI/CD validates changes
   - Human review via the platform

3. **Cross-Functional Visibility**
   - Dashboard shows issues, blockers, agent activity
   - Everyone sees progress and context

## MVP Focus

The MVP focuses on the core collaborative loop:

1. **Issue Selection** → AI researches related code → provides background
2. **Team Chat** → PM, designer, dev join → AI acts as judge, collecting info
3. **Living Document** → AI continuously updates final document or execution plan
4. **Handoff** → Ready for agent execution or human review

## Documentation Structure

- [`/architecture`](architecture/) - System architecture and technical stack
- [`/data-model`](data-model/) - Database schema and entity definitions
- [`/api`](api/) - API specifications and endpoints
- [`/ui`](ui/) - UI/UX design and component specifications
- [`/implementation`](implementation/) - Implementation phases and milestones

## Quick Start

See [`/implementation/phases.md`](implementation/phases.md) for the implementation roadmap.
