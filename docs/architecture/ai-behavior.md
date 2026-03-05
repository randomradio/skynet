# AI Behavior Specification

## Overview

The AI acts as an active participant in the development workflow, not just a chatbot. It:
1. Gathers information from discussions
2. Maintains a living document that synthesizes understanding
3. Fetches code context when needed
4. Facilitates decision-making

## Core Behaviors

### 1. Information Collection

The AI actively tracks what is known vs unknown about an issue.

**Known Information Tracking:**
- Parse issue title and body for requirements
- Extract technical constraints from discussion
- Identify decisions made by participants
- Track action items and owners

**Gap Identification:**
- When requirements are unclear, ask clarifying questions
- Identify missing technical details
- Flag conflicting information
- Request input from specific roles when needed

**Example Behavior:**
```
User: "We need to add caching to the query engine"

AI: "I'll help you design this caching feature. Let me first understand:

1. What type of cache are you considering? (in-memory, distributed like Redis)
2. What's the expected data size per cache entry?
3. Are there any cache invalidation requirements?

Let me also fetch the current query engine implementation to understand the architecture."

[AI fetches relevant code files]
```

### 2. Code Context Fetching

The AI proactively and reactively fetches code to inform discussions.

**Proactive Fetching:**
- On issue open: Fetch files related to mentioned components
- During discussion: Fetch code referenced in messages
- Before plan generation: Fetch full context of affected modules

**Reactive Fetching:**
- When explicitly asked: "Can you check the implementation of X?"
- When encountering unknown terms: Fetch files matching keywords
- When generating plan: Fetch all files in affected modules

**Fetch Indicators:**
- Show loading state when fetching
- Display which files were fetched
- Allow users to click to view fetched code

**Example:**
```
User: "The error happens in the executor"

AI: "Let me examine the executor code to understand the issue better."

[Fetching: pkg/sql/executor.go, pkg/sql/executor_test.go]

AI: "I found the issue. In executor.go line 145, there's a null pointer
dereference when the query plan is nil. Here's the relevant code:

```go
// executor.go:145
result := plan.Execute(ctx)  // plan can be nil here
```

Should we add a nil check or ensure plan is always set?"
```

### 3. Synthesis (Living Document)

The AI maintains a continuously updated document synthesizing the discussion.

**Update Triggers:**
- Every 3-5 new messages
- When a significant decision is made
- When explicitly requested ("@ai update the plan")
- Before finalization

**Document Structure:**
```markdown
# Implementation Plan: [Issue Title]

## Overview
Brief summary of what needs to be done.

## Requirements
- Functional requirements
- Non-functional requirements
- Constraints

## Approach
High-level approach to implementation.

## Technical Design
- Files to modify
- Key changes
- Dependencies

## Open Questions
- Unresolved items that need discussion

## Decisions Made
- Decision 1 (by @user on date)
- Decision 2 (by @user on date)
```

**Example Update:**
```
AI: "I've updated the living document based on our discussion.

Changes made:
- Added caching strategy decision (Redis vs in-memory)
- Updated affected files list
- Marked 'cache invalidation' as resolved
- Added open question about TTL configuration

[View Updated Document]"
```

### 4. Facilitation

The AI actively moves the discussion toward resolution.

**Mention Suggestions:**
- "@pm, we need your input on the user-facing behavior"
- "@designer, this might need a UI mockup"
- "@engineer2, you worked on this module - any concerns?"

**Convergence Detection:**
- Identify when discussion has reached consensus
- Suggest: "It seems we've agreed on X. Should we finalize the plan?"
- Highlight remaining open questions

**Next Step Proposals:**
- "Based on our discussion, I suggest we:
  1. Finalize the technical approach
  2. Create the implementation plan
  3. Start the agent execution"

**Example:**
```
AI: "Based on our discussion, I believe we've reached consensus on:

✅ Cache type: Redis (decided by @engineer)
✅ TTL: 5 minutes (decided by @pm)
✅ Invalidation: On write operations (decided by @engineer)

Open question:
❓ Should we cache error responses? (@pm input needed)

Once we resolve this last question, we can finalize the implementation plan."
```

## Role-Specific Behavior

### When Interacting with PMs
- Focus on user impact and requirements
- Translate technical details into business impact
- Ask about acceptance criteria
- Suggest edge cases to consider

### When Interacting with Engineers
- Dive into technical details
- Suggest implementation approaches
- Flag potential technical risks
- Reference similar past implementations

### When Interacting with Designers
- Request mockups for UI changes
- Discuss user experience flows
- Clarify interaction behaviors

### When Interacting with Operators
- Discuss deployment considerations
- Ask about monitoring requirements
- Flag operational risks

## AI Participation Rules

### When to Respond
1. **Mentioned explicitly**: "@ai what do you think?"
2. **Question directed at AI**: "Can you check the code?"
3. **Technical discussion**: Code, architecture, implementation
4. **Requirement clarification**: Unclear or conflicting requirements
5. **After inactivity**: Summarize if discussion stalls

### When NOT to Respond
1. **Internal team discussions**: "@engineer let's sync offline"
2. **Social/chat**: "How was your weekend?"
3. **Already answered**: Question already resolved
4. **Too frequent**: Wait at least 30 seconds between responses

### Response Tone
- Professional but friendly
- Concise but complete
- Technical when appropriate
- Ask clarifying questions rather than assume

## Example Conversation Flow

```
[Issue #123: Add query result caching]

PM: "We need to improve query performance. Users are complaining about slow results."

AI: "I'll help you design a caching solution. A few questions to understand the requirements:

1. What's the current average query time vs target?
2. What percentage of queries are repeat queries?
3. Are there any data freshness requirements (how stale can cached data be)?

Let me also fetch the current query execution code to understand the architecture."

[AI fetches: pkg/sql/executor.go, pkg/sql/query_cache.go (if exists)]

Engineer: "Current p95 is 2s, target is 200ms. About 60% of queries are repeats."

PM: "Data can be up to 5 minutes stale for reporting queries, but real-time queries need fresh data."

AI: "Got it. So we need:
- Cache for reporting queries (5min TTL)
- No cache for real-time queries
- Target 10x improvement for cached queries

@designer, should we indicate to users when they're viewing cached results?"

Designer: "Yes, we should show a small indicator. I'll create a mockup."

[Designer attaches mockup]

AI: "Thanks @designer. Based on the mockup, I understand the UI requirements.

@engineer, for the technical implementation, I'm considering:
1. Add a cache layer in the executor
2. Use Redis for distributed caching
3. Add cache-bypass header for real-time queries

Any concerns with this approach?"

Engineer: "Redis makes sense. We should also consider cache warming for popular queries."

AI: "Good point on cache warming. I'll add that to the considerations.

[AI updates living document]

The document now includes:
- Cache warming strategy
- Redis configuration notes
- Cache indicator UI requirements

Are we ready to finalize this plan?"

PM: "Yes, let's proceed."

Engineer: "Agreed."

AI: "Great! I'll finalize the implementation plan. You can review it in the sidebar.

[Finalize button becomes active]

Once you're satisfied, click 'Finalize' and we can start the agent execution."
```

## PRD Agent 行为规范（Stage 1）

### 触发条件
- 用户在需求详情页点击"生成 PRD 草稿"（stage = `discovery`）
- 禁止并发触发（同一需求只允许一个 PRD 生成任务）

### 输入上下文构建

```
1. requirement.description（原始需求描述）
2. keyword 搜索相关代码（从需求标题提取关键词，同 chat.ts 逻辑）
3. 现有 open issues（标题列表，用于查重提示）
4. discussion 历史（如果需求关联了讨论，取最近 20 条）
5. 现有 prdDocument（如果有，增量更新而非覆盖）
```

### 输出规范

PRD Agent **必须**严格按照以下结构输出，每节必须有内容（实在无法确定时写"待确认"）：

```markdown
## 背景与目标
[1-3 段，解释为什么做这个需求，成功的衡量标准]

## 用户故事
[Markdown 列表，格式：作为 {角色}，我需要 {功能}，以便 {价值}]

## 功能需求
[编号列表，每条明确、可测试]

## 非功能需求
[性能、安全、可用性等，每条有具体数字指标]

## 技术约束（从代码分析得出）
[引用实际代码结构、现有 API、技术栈限制]

## 验收标准
[编号列表，每条必须可以被自动化测试或人工验证，格式：{Given}/{When}/{Then} 或 Checklist]

## 开放问题
[尚未确定的事项，每条后面注明"需要 @角色 确认"]
```

### 验收标准质量要求

PRD Agent 在 prompt 中被要求：
- 每条验收标准必须是**可测试的**（能写成测试用例或明确的人工验证步骤）
- 禁止模糊表述（如"系统响应要快" → 必须写"P95 响应时间 < 200ms"）
- 至少 3 条，最多 15 条

### 流式输出行为

- SSE 流式返回，每个 `chunk` 事件带当前增量文本
- 完成后发送 `done` 事件，写入 requirement.prdDocument
- 生成过程中 UI 显示实时填充效果

---

## Review Agent 行为规范（Stage 4）

### 触发条件
- PR 创建后自动触发（webhook → 启动 review-worker）
- 或人工在 PR 页面点击"运行 AI 验收"

### 输入上下文构建

```
1. PR diff（所有变更文件）
2. prd-output.md（从 Context Bundle 读取 PRD 全文）
3. 解析出的验收标准列表（从 PRD ## 验收标准 节提取）
4. test-results（npm test 输出，由 Review Container 运行）
5. build 结果（npm run build 输出）
```

### 验收处理逻辑

```
for each 验收标准条目:
  1. 分类：代码变更可验证 vs 运行时可验证 vs 需人工确认
  2. 对于代码可验证项：分析 diff 是否实现了该条目
  3. 对于运行时项：读取 test results，查找相关测试
  4. 标注结果：✅ 通过 / ❌ 未通过 / ⚠️ 需人工确认
  5. 未通过时提供具体原因和修复建议
```

### 输出报告格式

```markdown
# PR #123 验收报告

**总结**：满足 8/10 条验收标准，1 条未通过，1 条需人工确认。

## 验收结果

✅ [1] 用户可点击导出按钮
✅ [2] 导出文件格式为有效 CSV
✅ [3] 导出大文件（>10MB）时显示进度
❌ [4] 导出失败时显示错误提示
   - 原因：diff 中未找到错误处理分支
   - 建议：在 ExportController.ts:45 添加 try-catch，catch 中调用 showError()
✅ [5] 导出文件名包含时间戳
...
⚠️ [9] 并发导出不影响系统性能
   - 需人工确认：需要在生产环境并发测试，无法从代码或单测得出

## 建议操作

- 修复 [4] 后可 merge
- [9] 建议在 PR description 说明测试计划
```

### 验收不通过时的处理流程

```
生成报告 → 写入 /workspaces/pr-{N}/context/review-feedback.md
          → 在 PR 页面展示报告
          → 如果有 failed 条目：
              → 提示"需要修复后重新 review"
              → 支持 resume issue session：
                  query({resume: issueSessionId}, feedback)
                  → dev-worker 收到 feedback 后 force push → review 重跑
```

---

## Implementation Notes

### Context Management
- Keep last 50 messages in context
- Include living document in every prompt
- Include fetched code snippets
- Track mentioned users and their roles

### API Calls
- Use Anthropic SDK with streaming
- Set max_tokens based on response type
- Use structured output for living document updates
- Implement retry logic for failed calls

### Performance
- Fetch code in parallel with AI response generation
- Cache fetched code for 5 minutes
- Pre-generate living document updates in background
- Use WebSocket for real-time updates

### Error Handling
- If AI call fails: Show error, allow retry
- If code fetch fails: Continue without context, warn user
- If synthesis fails: Keep previous version, log error
- If PRD generation interrupted: Resume from last written chunk on retry
- If Review Container fails to start: Fall back to pure diff-based AI review（无测试结果）
