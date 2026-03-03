# Development Plan (Based on Current Design Review)

## 0. Baseline

Current repository status (2026-03-02):
- `docs/` and `references/` exist.
- Workspace monorepo skeleton exists: `apps/`, `packages/`, `pnpm-workspace.yaml`, `turbo.json`.
- `apps/web` and `apps/agent-runtime` are placeholders pending full initialization.

This plan therefore starts from project bootstrap, not feature iteration on existing app code.

## 1. Design Review Findings (Resolved Decisions on 2026-03-02)

### P0

1. MVP scope conflict:
- `docs/INDEX.md` says MVP is phases 1-2 but includes chat/living document.
- `docs/implementation/phases.md` puts chat/living document in phase 3.
- Decision: keep chat/living document in phase 3. MVP phase 1-2 focuses on issue management.

2. Agent status contract mismatch:
- API cancel response uses `cancelled`.
- Entity type and SQL enum do not include `cancelled`.
- Decision: unify `AgentStatus` and include `cancelled` in API/entity/schema.

3. Auth contract mismatch:
- API spec says Bearer JWT for all APIs.
- Previous AGENTS guidance used NextAuth session auth.
- Decision: adopt Bearer JWT for API authentication.

### P1

1. Runtime mode inconsistency:
- README describes local agent execution on engineer machine.
- Architecture describes remote AIOSandbox container execution.
- Decision: code generation and execution run in AIOSandbox.

2. Discussion API path inconsistency:
- Previous API spec mixed `/api/issues/{issueId}/discussion` and `/api/discussions/{id}/messages`.
- Previous project structure used `app/api/discussions/...`.
- Decision: discussion APIs are nested under issue routes.

3. App structure mismatch:
- Prior docs mixed single-app and workspace assumptions.
- Decision: adopt workspace monorepo (`apps/*`, `packages/*`) and initialize web in `apps/web` without `--src-dir`.

### P2

1. Environment variable naming inconsistency:
- `GITHUB_WEBHOOK_SECRET` vs `WEBHOOK_SECRET`.
- Decision: use `GITHUB_WEBHOOK_SECRET` as canonical name.

## 2. Execution Strategy

Principle: use "Contract First + Vertical Slice".
- Contract First: freeze API/data/auth/runtime contracts before coding.
- Vertical Slice: each sprint delivers one end-to-end usable workflow.

## 3. 10-Week Plan (5 Sprints x 2 weeks)

## Sprint 0 (Week 1): Contract Alignment + Bootstrap

Goals:
- Resolve all P0/P1 doc conflicts.
- Initialize `apps/web` and `apps/agent-runtime` on workspace monorepo.

Tasks:
- Add Architecture Decision Records (ADR) for auth, runtime mode, API route convention.
- Create Next.js 15 app + TypeScript strict + Tailwind + shadcn.
- Create Drizzle config and initial MatrixOne connection test.
- Create CI baseline (`lint`, `typecheck`, `test` placeholders).

Exit criteria:
- ADRs approved.
- `pnpm --filter @skynet/web lint` and `pnpm --filter @skynet/web typecheck` pass.
- Health check API can connect to MatrixOne in dev.

## Sprint 1 (Weeks 2-3): Foundation

Goals:
- Implement authentication and base layout.
- Establish database schema and migration pipeline.

Tasks:
- GitHub OAuth setup + Bearer JWT issuance.
- Protected dashboard shell (`/app/(dashboard)`).
- Drizzle schema for users, repositories, issues, webhook events.
- Unified error response format and API middleware.

Exit criteria:
- Login/logout works end-to-end.
- Protected routes enforce auth.
- Initial migration applies successfully.

## Sprint 2 (Weeks 4-5): Issue Management Vertical Slice

Goals:
- Sync GitHub issues and show list/detail with AI summary.

Tasks:
- Webhook endpoint with signature verification and idempotency.
- Manual sync endpoint + incremental sync job.
- `/api/issues` list/detail endpoints.
- Issue list/detail UI pages.
- AI summary pipeline (async queue or background job).

Exit criteria:
- Selected repo issues can be synced and viewed in UI.
- AI summary generated for newly synced issues.
- Basic filter/search/pagination works.

## Sprint 3 (Weeks 6-7): Discussion + Living Document

Goals:
- Enable issue discussion and AI participation with synthesized document.

Tasks:
- discussions/messages schema and APIs.
- Discussion page with message stream and mention parsing.
- AI participant behavior (trigger rules + cooldown).
- Living document panel update logic (every N messages + manual trigger).

Exit criteria:
- Users can discuss on issue detail page.
- AI can respond with referenced code context.
- Finalize flow locks synthesized plan.

## Sprint 4 (Weeks 8-9): Agent Runtime MVP

Goals:
- Run agent execution loop and stream run status/logs.

Tasks:
- Provision AIOSandbox + lifecycle APIs.
- Agent run state machine, logs, artifacts, cancel flow.
- PR creation flow via GitHub token.

Exit criteria:
- One issue can complete "plan -> code -> test -> PR" happy path.
- Agent logs are visible in UI with realtime status updates.
- Failure handoff produces actionable context.

## Sprint 5 (Week 10): Stabilization + Launch Readiness

Goals:
- Improve reliability, observability, and onboarding.

Tasks:
- Performance pass for main queries/endpoints.
- Audit logging, retries, and timeout policies.
- Basic role-based dashboard variants.
- Developer onboarding and runbook docs.

Exit criteria:
- P0 bugs closed.
- Critical flows have smoke tests.
- New developer can run project locally using docs only.

## 4. Workstream Breakdown

Backend/API:
- Auth middleware, issue sync, discussions, agent orchestration.

Frontend:
- Dashboard, issue list/detail, discussion/living doc, agent console.

Data:
- Drizzle schema, migrations, query optimization, activity logging.

AI:
- Issue analyzer, discussion participant, living doc synthesizer.

Runtime:
- Agent process, iteration policy, git/pr automation, log streaming.

## 5. Quality Gates

Every sprint must satisfy:
- TypeScript strict pass.
- Lint pass.
- Contract tests for changed APIs.
- One end-to-end smoke path demo.
- Updated docs for any contract change.

## 6. Execution Rules

1. Mark task done only after related tests pass.
2. Ask user for token/API key/secret when needed; never assume credentials.
3. Include verification command results in status updates.

## 7. Immediate Next Actions (This Week)

Completed:
- [x] Initialize real Next.js app in `apps/web`.
- [x] Initialize real Node runtime in `apps/agent-runtime`.
- [x] Deliver Sprint 0 output (health check + CI baseline + workspace package boundaries).

Next:
1. [x] Implement GitHub OAuth callback + JWT issuance API (completed 2026-03-03; requires user-provided GitHub app credentials in env for runtime validation).
2. Add DB migration execution and first migration artifact under `packages/db`.
3. Add first API contract tests for auth and issue list routes.
