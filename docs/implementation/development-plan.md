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

---

## Phase 2：全产品生命周期扩展（Sprint A-D）

> 在 Sprint 0-5 基础上，将 AI 驱动范围从 Issue 向上延伸至需求（PRD）、向下延伸至验收。
> 当前已完成：Sprint 0 + Sprint 1 已验证通过（2026-03-05）。

### Sprint A：数据模型 + Requirement 实体

**目标**：建立 Requirement 顶层实体，支持 stage 流转和 Issue 关联。

| 任务 | 文件 | 备注 |
|------|------|------|
| requirements 表 + agentSessions 表 | `packages/db/src/schema.ts` | 新增两张表 |
| issues 表加 requirementId 字段 | `packages/db/src/schema.ts` | nullable，软关联 |
| requirements CRUD query layer | `packages/db/src/requirements.ts`（新） | list/get/create/update/stage 流转 |
| agent-sessions CRUD | `packages/db/src/agent-sessions.ts`（新） | register/find/resume/complete |
| Requirements REST API | `apps/web/app/api/requirements/[...]/` | list/create/get/patch stage |
| 需求列表页 | `apps/web/app/(dashboard)/requirements/page.tsx`（新） | 按 stage 分组展示 |
| 需求详情页（基础） | `apps/web/app/(dashboard)/requirements/[id]/page.tsx`（新） | 需求信息 + 关联 issues |

**Exit 标准**：
- 可创建需求、查看列表、手动切换 stage
- requirementId 可关联已有 issue
- lint/typecheck/test 通过

---

### Sprint B：PRD Agent + 技术拆解 Agent

**目标**：Stage 1（PRD 生成）+ Stage 2（技术拆解）完全可用，流式输出。

| 任务 | 文件 | 备注 |
|------|------|------|
| 扩展 synthesizeDocument()，加 PRD 模式 | `apps/web/lib/ai/synthesize.ts` | 加 `codeContext?: string`，PRD prompt |
| PRD 生成 SSE API | `apps/web/app/api/requirements/[id]/prd/route.ts`（新） | POST → SSE 流式 |
| PRD Finalize API | `apps/web/app/api/requirements/[id]/prd/finalize/route.ts`（新） | stage → prd，写 prdFinalizedAt |
| generateIssues() | `apps/web/lib/ai/generate-issues.ts`（新） | 技术拆解 Agent，输出 GeneratedIssue[] |
| 技术拆解预览 API | `apps/web/app/api/requirements/[id]/breakdown/route.ts`（新） | 返回预览，不写 DB |
| 技术拆解确认 API | `apps/web/app/api/requirements/[id]/breakdown/confirm/route.ts`（新） | 批量创建 issues + 推 GitHub |
| PRD 编辑器组件 | `apps/web/components/requirements/prd-editor.tsx`（新） | 流式显示 + 编辑 + Finalize 按钮 |
| Issue 预览确认组件 | `apps/web/components/requirements/issue-preview.tsx`（新） | 卡片列表 + warning + 确认按钮 |

**Exit 标准**：
- 输入需求描述 → 流式看到 PRD 生成 → Finalize → 生成 Issue 预览 → 确认推送到 GitHub
- 生成期间禁止重复触发（409 返回）
- 重复 issue 检测显示 warning

---

### Sprint C：Session 注册表 + Context Bundle

**目标**：跨阶段上下文传递机制上线，issue session → PR session 生命周期打通。

| 任务 | 文件 | 备注 |
|------|------|------|
| session-registry.ts | `apps/web/lib/agent/session-registry.ts`（新） | register/find/resume/complete |
| context-bundle.ts | `apps/web/lib/agent/context-bundle.ts`（新） | write/read（摘要）/copyToPR |
| dev-worker 启动时注入 Context Bundle | `apps/web/lib/agent/engine.ts` | prompt 开头加 `<context>` |
| dev-worker 完成时写 Context Bundle | `apps/web/lib/agent/engine.ts` | 写 implementation-plan.md |
| PR 创建时触发 copyContextBundleToPR() | `apps/web/app/api/agents/[id]/create-pr/route.ts` | issue context → pr context |
| review-worker 读 PR Context Bundle | `apps/web/lib/agent/engine.ts` | 读 prd-output.md 作为验收标准 |
| agentSessions 与 engine.ts 集成 | `apps/web/lib/agent/engine.ts` + `db/agent-sessions.ts` | 每次 agent 启动注册，支持 resume |

**Exit 标准**：
- dev-worker 完成后 `/workspaces/req-{id}/context/implementation-plan.md` 有内容
- 创建 PR 后 `/workspaces/pr-{N}/context/prd-output.md` 已复制
- review-worker 能读取到 PRD 验收标准

---

### Sprint D：WorkerPool + Review Container + 时间度量

**目标**：并发管理、PRD 对照验收、Dashboard 度量指标全部上线。

| 任务 | 文件 | 备注 |
|------|------|------|
| WorkerPool 类 | `apps/web/lib/agent/worker-pool.ts`（新） | queue + dispatch + maxConcurrent |
| agent run 创建走 pool | `apps/web/app/api/agents/route.ts` | pool.dispatch()，返回排队位置 |
| Review Agent 读 PRD 验收标准 | `apps/web/lib/agent/get-review.ts` | 解析 prd-output.md 的验收标准 |
| 验收报告生成 | `apps/web/lib/agent/engine.ts` | 逐条 ✅/❌/⚠️ 格式 |
| Dashboard 需求漏斗图 | `apps/web/app/(dashboard)/dashboard/page.tsx` | 各 stage 平均耗时条形图 |
| 需求级度量 API | `apps/web/app/api/dashboard/route.ts` | 返回需求时间度量数据 |

**Exit 标准**：
- 并发触发 3 个 dev-worker → 第 3 个显示"排队中"
- PR Review 报告逐条显示 PRD 验收标准通过情况
- Dashboard 显示需求各 stage 平均耗时

---

## Phase 2 质量门控（同 Phase 1）

- TypeScript strict 通过
- lint + typecheck + test 全通过
- 新增 API 有 contract test
- 文档与实现同步更新
- 每个 Sprint Exit 有 smoke 演示
