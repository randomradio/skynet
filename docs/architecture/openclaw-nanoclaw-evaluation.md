# NanoClaw / OpenClaw 方案对齐（Skynet 讨论稿）

> 目标：先把你的核心思路收敛成可执行架构，不急于一次性写大而全方案。

## 1. 你的核心思路（归纳）

你希望 Skynet 里的 agent 接近 NanoClaw/NanoCloud 这类“持续运营型 agent”：

1. 自动同步并审视 **Issue + PR** 的最新状态。
2. 发现卡点时，能够 **重新拉起/恢复 git workflow** 做反馈与修复。
3. 给人类提供 **界面化反馈控制**，人类主要负责观察与决策，不陷入重复实现细节。

这不是一次性 code generation，而是长期运行的“观察-行动-反馈”闭环。

---

## 2. 先对齐能力，不绑定具体实现

基于公开资料和工程常见模式，NanoClaw/OpenClaw 类方案可抽象为四个核心能力：

- **状态感知（Observe）**：持续读取 issue、PR、review、CI、comment。
- **执行调度（Decide）**：判断是否需要进入修复/推进流程。
- **隔离执行（Act）**：在 worktree/容器中执行计划、改动、验证。
- **人工回路（Human-in-the-loop）**：关键节点给人类审批与反馈按钮。

Skynet 当前架构已经覆盖了大部分执行侧能力（API + agent runtime + AIOSandbox）；主要缺口是“持续审视 + 可恢复 workflow + 可视化反馈控制”的产品化闭环。

---

## 3. 建议的最小闭环：双循环模型

### 3.1 Observe Loop（持续审视循环）

输入源：
- GitHub webhook（issue、pull_request、issue_comment、pull_request_review、check_run）
- 定时补偿扫描（防 webhook 丢失）

处理动作：
- 汇总 issue/PR 状态
- 计算 `review_state`
- 触发后续动作或进入等待人工

建议状态：
- `idle`：无动作
- `needs_action`：需要 agent 执行
- `running`：agent 正在执行
- `waiting_human`：等待人工确认
- `blocked`：依赖外部条件

### 3.2 Action Loop（执行循环）

当 `review_state=needs_action`：
1. 创建或恢复 run（优先复用现有 PR 分支）
2. 创建/恢复 worktree
3. 生成或更新 coding plan
4. 执行改动 + 质量闸门（lint/test/build）
5. 回写 PR 和状态摘要
6. 进入下一个审视周期

---

## 4. “重启 git workflow”的触发规则（建议首版）

### 4.1 触发事件 → 动作

- PR CI failed → 进入 `needs_action`，创建 repair run
- Reviewer `changes requested` → 进入 `needs_action`，追加修复计划
- Issue 新增 `agent:run` 标签 → 新建执行 run
- Issue/PR 72 小时无进展且为 P0/P1 → 触发健康检查 run

### 4.2 恢复策略（避免无效重跑）

- 若存在同 issue 且状态健康的 open PR：优先“续跑”该分支
- 若分支冲突不可自动修复：新建分支并标注 `supersedes`
- 若连续失败超过阈值：转 `waiting_human`

---

## 5. 人类反馈界面（你图里的关键点）

建议优先做三个 UI 面板：

1. **Issue Agent Timeline**
   - 展示 observe 判定、触发原因、执行结果
2. **Run Control Panel**
   - `Approve Plan` / `Retry` / `Stop` / `Escalate`
3. **PR Feedback Inbox**
   - 聚合 review 评论、CI 报错、agent 拟修复建议

原则：人类工程师做“方向和风险控制”，agent 做“重复执行与状态推进”。

---

## 6. 与 Skynet 当前实现的衔接建议

短期（不换技术栈）：
- 在 TypeScript runtime 上先实现 Observe Loop + Action Loop 的最小闭环
- 增加 `review_state` 与 `run_attempt` 记录（可审计）
- 在 Web 侧先做轻量控制面板

中期（需要性能/并发扩展时）：
- 将调度与状态机拆分成独立 orchestrator 服务（可用 Go）
- Web/API 继续保留在 Next.js + TypeScript
- 通过 HTTP/gRPC + 队列对接，降低迁移风险

---

## 7. 下一步讨论建议（先讨论，不急着写大方案）

建议你先拍板这 4 件事：

1. `review_state` 状态枚举（是否需要更多状态）
2. “重启 workflow”事件表（哪些事件自动、哪些需人工）
3. 人类控制按钮最小集（MVP）
4. 失败转人工阈值（连续失败次数/时长/风险等级）

拍板后再进入实现 backlog，避免文档先行但执行偏差。
