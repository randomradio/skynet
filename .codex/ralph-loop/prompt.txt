Objective: Implement GitHub OAuth callback + platform JWT issuance in apps/web, wired to existing auth/session flow and Bearer JWT API contract.

Context:
- Monorepo with Next.js web app (apps/web), shared contracts in packages/sdk, MatrixOne via MySQL protocol.
- Sprint 0 readiness complete; moving into Foundation auth implementation.

Constraints:
- Keep API auth contract as Bearer JWT.
- Ask user for token/API key/secret when needed; never assume missing credentials.
- Do not commit secrets or write real credentials into repo files.
- Mark tasks done only after validation commands pass.
- Keep chat/discussion/living-document work out of scope (Phase 3).
- Keep management-first scope; do not expand into issue sync/runtime beyond auth wiring.
- Preserve MatrixOne env naming policy (MATRIXONE_URL primary, DATABASE_URL compatibility).
- Keep error response format: { "error": { "code": "...", "message": "..." } }.

Non-goals:
- GitHub webhook sync or issue ingestion.
- Discussion/chat/living-document features.
- AIOSandbox runtime features beyond current scaffolding.

Success criteria:
- OAuth callback route exchanges GitHub code using configured app credentials and handles failure paths.
- Platform JWT issuance path integrates with existing auth flow and protected routes/APIs.
- Auth endpoints return contract-compliant payloads and status codes.
- Docs/readiness notes updated to reflect implemented auth behavior.
- All validation commands pass.

Validation:
1) pnpm --filter @skynet/web lint
2) pnpm typecheck
3) pnpm test
4) pnpm --filter @skynet/web build

Progress scope:
- apps/web/**
- packages/sdk/**
- docs/implementation/**

Source of truth:
- AGENTS.md
- docs/api/endpoints.md
- docs/implementation/development-plan.md
- docs/implementation/implementation-readiness.md

Suggested output:
- Include concise evidence for each success criterion.
- List exact files changed and why each change was necessary.
- Report validation command outputs (pass/fail + key lines), not just status.
- Call out assumptions and credentials still required from user.
- If blocked, provide minimal unblock checklist with the next concrete command.
