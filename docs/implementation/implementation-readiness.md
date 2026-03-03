# Implementation Readiness

## Purpose

This checklist defines whether the repository is ready to move from planning to execution.

## Current Review (2026-03-02)

- Monorepo skeleton is in place (`apps/*`, `packages/*`).
- Architecture/API/data-model contracts are aligned for:
  - Bearer JWT authentication
  - Issue-nested discussion routes
  - `cancelled` agent status
  - AIOSandbox execution mode
- `apps/web` is initialized as a real Next.js app with dashboard shell, issue-management shell, and Bearer JWT-protected sample APIs.
- Dashboard now includes a minimal authenticated session bootstrap flow (`/api/auth/token` -> `/api/example`) with HTTP-only cookie-backed auth.
- Dashboard auth flow now includes explicit session revoke via `POST /api/auth/logout`.
- Dashboard and issues pages now enforce server-side cookie-session auth with unauthenticated redirect to `/`.
- Landing page (`/`) now provides authenticated session bootstrap and redirects authenticated users to `/dashboard`.
- GitHub OAuth callback route now exchanges GitHub code for access token, resolves GitHub user, issues platform Bearer JWT, and sets the existing HTTP-only session cookie contract.
- GitHub OAuth helper coverage now includes upstream token exchange failure and malformed user payload failure-path tests.
- Issues API (`/api/issues`) now reads via `packages/db` Drizzle scaffold with explicit `MATRIXONE_URL` (and `DATABASE_URL` compatibility fallback) not-configured behavior.
- `apps/agent-runtime` is initialized with a TypeScript runtime scaffold.
- `packages/db` includes Drizzle schema/client scaffold and database health probing.
- CI baseline workflow is in place at `.github/workflows/ci.yml`.

## Execution Rules

1. Mark a task as done only after related tests pass.
2. If a token/API key/secret is required, request it from the user first; do not assume or fabricate credentials.
3. Record verification commands and outcomes in the task update.

## Definition Of Done (Per Task)

- Implementation complete.
- Relevant checks pass:
  - `lint`
  - `typecheck`
  - `test`
- Docs/contracts updated when behavior or interfaces changed.

## Sprint 0 Ready Queue

- [x] Initialize real Next.js app in `apps/web`.
- [x] Add dashboard shell page in `apps/web/app/(dashboard)/dashboard/page.tsx`.
- [x] Add Bearer JWT helper and protected sample API route in `apps/web/app/api/example/route.ts`.
- [x] Initialize real Node.js runtime in `apps/agent-runtime`.
- [x] Set up `packages/db` Drizzle scaffold.
- [x] Add CI baseline workflows for lint/typecheck/test.
- [x] Add health-check API and database connectivity check.
- [x] Add JWT bootstrap token route in `apps/web/app/api/auth/token/route.ts` and auth helper tests.
- [x] Add dashboard auth session bootstrap panel that requests JWT then calls protected API.
- [x] Add cookie-backed auth session flow (HTTP-only cookie issuance and protected API cookie fallback).
- [x] Add logout endpoint and dashboard action to clear HTTP-only auth session cookie.
- [x] Add server-side dashboard route protection using cookie-backed session verification and unauthenticated redirect.
- [x] Add authenticated landing flow on `/` with session bootstrap and post-auth redirect to `/dashboard`.
- [x] Wire `/api/issues` to `packages/db` Drizzle query scaffold with non-breaking `MATRIXONE_URL` + `DATABASE_URL` compatibility fallback behavior.
- [x] Add persisted issue detail endpoint `GET /api/issues/[id]` backed by `packages/db` with JWT auth and non-breaking `MATRIXONE_URL` + `DATABASE_URL` compatibility fallback behavior.
- [x] Implement `GET /api/auth/github/callback` for GitHub OAuth code exchange + platform JWT issuance wired to cookie-backed session auth.
- [x] Add GitHub OAuth auth-helper failure-path tests for callback dependencies (exchange unavailable + malformed profile payload).

## Validation Log (2026-03-02)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `pnpm --filter @skynet/web test` -> PASS (Vitest exit 0)
- `pnpm --filter @skynet/web build` -> PASS (`next build`)
- `pnpm --filter @skynet/agent-runtime typecheck` -> PASS (`tsc --noEmit`)
- `pnpm --filter @skynet/agent-runtime test` -> PASS (Vitest exit 0)
- `pnpm --filter @skynet/agent-runtime build` -> PASS (`tsc -p tsconfig.json`)
- `pnpm --filter @skynet/db typecheck` -> PASS (`tsc --noEmit`)
- `pnpm --filter @skynet/db test` -> PASS (Vitest exit 0)
- `pnpm --filter @skynet/sdk typecheck` -> PASS (`tsc --noEmit`)
- `pnpm --filter @skynet/sdk test` -> PASS (Vitest exit 0)
- `pnpm lint` -> PASS (turbo)
- `pnpm typecheck` -> PASS (turbo)
- `pnpm test` -> PASS (turbo)

Last verified: 2026-03-02

## Validation Log (2026-03-02 Iteration 5)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 2 files, 6 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)

## Validation Log (2026-03-02 Iteration 6)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 2 files, 6 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)
- `pnpm --filter @skynet/sdk typecheck` -> PASS (`tsc --noEmit`)

## Validation Log (2026-03-02 Iteration 7)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 4 files, 13 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)

## Validation Log (2026-03-02 Iteration 8)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 4 files, 14 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)
- `pnpm --filter @skynet/sdk typecheck` -> PASS (`tsc --noEmit`)

## Validation Log (2026-03-02 Iteration 9)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> FAIL initially (`.next/types` referenced removed `app/(dashboard)/dashboard/layout.tsx`), then PASS after restoring file as pass-through layout and rerunning `tsc --noEmit`
- `npm --prefix apps/web run test` -> PASS (Vitest: 5 files, 17 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)

## Validation Log (2026-03-02 Iteration 10)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 5 files, 17 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)

## Validation Log (2026-03-02 Iteration 11)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 5 files, 17 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)
- `pnpm --filter @skynet/db typecheck` -> PASS (`tsc --noEmit`)

## Validation Log (2026-03-02 Iteration 12)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm --filter @skynet/web typecheck` -> PASS (`tsc --noEmit`)
- `npm --prefix apps/web run test` -> PASS (Vitest: 5 files, 17 tests passed)
- `npm --prefix apps/agent-runtime run test` -> PASS (Vitest `--passWithNoTests`, no test files, exit 0)
- `pnpm --filter @skynet/db typecheck` -> PASS (`tsc --noEmit`)
- `pnpm --filter @skynet/sdk typecheck` -> PASS (`tsc --noEmit`)

## Validation Log (2026-03-03 Iteration 1)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm typecheck` -> PASS (`turbo run typecheck`)
- `pnpm test` -> PASS (`turbo run test`)
- `pnpm --filter @skynet/web build` -> PASS (`next build`)

## Validation Log (2026-03-03 Iteration 2)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm typecheck` -> PASS (`turbo run typecheck`, tasks: 4 successful, 4 total)
- `pnpm test` -> PASS (`turbo run test`; `@skynet/web`: 7 files, 24 tests passed; includes `lib/auth/github-oauth.test.ts` 6 tests)
- `pnpm --filter @skynet/web build` -> PASS (`next build`, compiled successfully; route manifest includes `ƒ /api/auth/github/callback`)

## Validation Log (2026-03-03 Iteration 3)

- `pnpm --filter @skynet/web lint` -> PASS (`next lint`, no ESLint warnings/errors)
- `pnpm typecheck` -> PASS (`turbo run typecheck`, tasks: 4 successful, 4 total)
- `pnpm test` -> PASS (`turbo run test`; `@skynet/web`: 7 files, 24 tests passed)
- `pnpm --filter @skynet/web build` -> PASS (`next build`, compiled successfully; route manifest includes `ƒ /api/auth/github/callback`)
