# Engineering Principles (Long-Term)

This document captures long-term engineering principles inspired by mature platform practices (including OpenAI/Stripe style patterns): strong contracts, reliability, observability, and safe evolution.

## 1. Contract First

- Design and version API contracts before implementation.
- Keep backward compatibility for public and inter-service interfaces.
- Treat schema/API changes as explicit migrations with rollout plans.

## 2. Reliability as a Feature

- Idempotency for write operations that may be retried.
- Timeouts, retries, and circuit-breaker style protection for external dependencies.
- Explicit failure modes and handoff paths for AI agent execution.

## 3. Security by Default

- Least-privilege access for GitHub tokens and runtime credentials.
- Isolated execution in AIOSandbox for code generation/testing.
- Secrets never logged; scoped secrets per run.

## 4. Observability First

- Structured logs with correlation IDs (`requestId`, `agentRunId`, `webhookEventId`).
- Health checks and SLO-oriented metrics for critical workflows.
- Auditable event trail for issue sync, AI analysis, and agent runs.

## 5. Clear Ownership and Boundaries

- Monorepo with explicit package boundaries (`apps/*`, `packages/*`).
- Shared logic in packages (`@skynet/db`, `@skynet/sdk`, `@skynet/ui`) instead of copy/paste.
- Every module has a clear owner and test expectations.

## 6. Incremental Delivery

- Ship vertical slices with working end-to-end flow.
- Prefer reversible changes and feature flags for risky capabilities.
- Keep docs, contracts, and implementation in lockstep.
