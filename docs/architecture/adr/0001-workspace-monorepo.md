# ADR-0001: Adopt Workspace Monorepo Layout

- Status: Accepted
- Date: 2026-03-02

## Context

The project needs long-term scalability across web product, agent runtime, shared libraries, and infra tooling. A single-app layout (`web/`, `agent-runtime/`) is sufficient short-term but creates friction for shared package governance and CI scaling.

## Decision

Adopt workspace monorepo layout:

```text
apps/
  web/
  agent-runtime/
packages/
  config/
  db/
  sdk/
  ui/
```

Root orchestration uses `pnpm-workspace.yaml` + `turbo.json`.

## Consequences

### Positive

- Clear separation between deployable apps and shared packages.
- Better CI parallelization and selective builds/tests.
- Safer long-term dependency and contract management.

### Tradeoffs

- Slightly higher bootstrap complexity.
- Requires disciplined package boundaries and ownership.

## Follow-Up

1. Initialize `apps/web` (Next.js 15) and `apps/agent-runtime` (Node 20 TS).
2. Move shared DB schema and API types into `packages/db` and `packages/sdk`.
3. Add CI matrix by workspace package.
