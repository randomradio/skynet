# UI/UX Design Specification

## Design System

### Color Palette

**Primary Colors:**

- `--color-primary-500`: #3B82F6 (Blue - main brand color)
- `--color-primary-600`: #2563EB (Blue hover)
- `--color-primary-50`: #EFF6FF (Blue background)

**Semantic Colors:**

- `--color-success-500`: #10B981 (Green - success, completed)
- `--color-warning-500`: #F59E0B (Amber - warning, in-progress)
- `--color-error-500`: #EF4444 (Red - error, failed)
- `--color-info-500`: #3B82F6 (Blue - info)

**Neutral Colors:**

- `--color-gray-900`: #111827 (Primary text)
- `--color-gray-700`: #374151 (Secondary text)
- `--color-gray-500`: #6B7280 (Tertiary text)
- `--color-gray-200`: #E5E7EB (Borders)
- `--color-gray-100`: #F3F4F6 (Backgrounds)
- `--color-gray-50`: #F9FAFB (Page background)

**Priority Colors:**

- P0: #DC2626 (Red - critical)
- P1: #F97316 (Orange - high)
- P2: #F59E0B (Amber - medium)
- P3: #6B7280 (Gray - low)

### Typography

**Font Family:**

- Primary: Inter, system-ui, sans-serif
- Mono: JetBrains Mono, Fira Code, monospace

**Scale:**

- `--text-xs`: 12px / 1.5
- `--text-sm`: 14px / 1.5
- `--text-base`: 16px / 1.5
- `--text-lg`: 18px / 1.4
- `--text-xl`: 20px / 1.3
- `--text-2xl`: 24px / 1.2
- `--text-3xl`: 30px / 1.2

### Spacing

**Base unit:** 4px

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-12`: 48px

---

## Page Layouts

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Dashboard    Issues    Agents    [User Avatar ▼]      │  ← Header (64px)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Organization Overview                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Open     │ │ P0/P1    │ │ Active   │ │ Blockers │   │   │
│  │  │ Issues   │ │ Issues   │ │ Agents   │ │          │   │   │
│  │  │   350    │ │    30    │ │     3    │ │     2    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Repositories           │  │  Recent Activity            │  │
│  │  ┌───────────────────┐  │  │  ─── agent_completed ...    │  │
│  │  │ matrixone      ▶  │  │  │  ─── issue_opened ...       │  │
│  │  │ 150 open issues   │  │  │  ─── comment_added ...      │  │
│  │  └───────────────────┘  │  │  ─── ...                    │  │
│  │  ┌───────────────────┐  │  └─────────────────────────────┘  │
│  │  │ matrixflow     ▶  │  │                                   │
│  │  │ 45 open issues    │  │  ┌─────────────────────────────┐  │
│  │  └───────────────────┘  │  │  Blockers                   │  │
│  │  ┌───────────────────┐  │  │  🔴 Issue #123: Critical... │  │
│  │  │ mo-cloud       ▶  │  │  │  🔴 Issue #456: Blocks...   │  │
│  │  │ 12 open issues    │  │  └─────────────────────────────┘  │
│  │  └───────────────────┘  │                                   │
│  └─────────────────────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Issue List Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Dashboard    Issues    Agents    [User Avatar ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  matrixorigin / matrixone                    [Refresh] [Sync]  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Search...]  [Filter ▼]  [Type ▼]  [Priority ▼]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  #123  🔴 P1  [bug]  Issue title here...        2h ago  │   │
│  │       🤖 Bug fix needed in SQL executor                 │   │
│  │       Assigned to: @user  Comments: 5                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  #122  🟡 P2  [feature]  Feature request...     5h ago  │   │
│  │       🤖 Add support for window functions               │   │
│  │       Assigned to: @user2  Comments: 3                  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  #121  🟢 P3  [task]  Refactor code...         1d ago   │   │
│  │       🤖 Code cleanup in parser package                 │   │
│  │       Unassigned  Comments: 0                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Previous]  Page 1 of 8  [Next]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Issue Detail Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Dashboard    Issues    Agents    [User Avatar ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [← Back to issues]              matrixorigin / matrixone      │
│                                                                 │
│  ┌────────────────────────────────────────┬──────────────────┐ │
│  │  #123  Issue Title Here                │  AI Analysis     │ │
│  │                                        │  ─────────────── │ │
│  │  🔴 P1  [bug] [performance]            │  Type: Bug       │ │
│  │                                        │  Priority: P1    │ │
│  │  Opened by @user 2 days ago            │  Complexity: Med │ │
│  │                                        │                  │ │
│  │  ───────────────────────────────────── │  🤖 Summary:     │ │
│  │                                        │  Bug in SQL...   │ │
│  │  ## Description                        │                  │ │
│  │  Full markdown description...          │  Tags:           │ │
│  │                                        │  [performance]   │ │
│  │  ## Steps to Reproduce                 │  [sql-engine]    │ │
│  │  1. Step one                           │                  │ │
│  │  2. Step two                           │  [Analyze]       │ │
│  │                                        │                  │ │
│  │                                        │  ─────────────── │ │
│  │  ───────────────────────────────────── │  Related Issues  │ │
│  │                                        │  #456 Similar... │ │
│  │  [💬 Start Discussion]                 │  #789 Related... │ │
│  │  [🤖 Start Implementation]             │                  │ │
│  │                                        │  ─────────────── │ │
│  │                                        │  Suggested       │ │
│  │                                        │  Assignees:      │ │
│  │                                        │  @engineer1      │ │
│  │                                        │  @engineer2      │ │
│  └────────────────────────────────────────┴──────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Discussion/Chat Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Dashboard    Issues    Agents    [User Avatar ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [← Back to issue #123]          [✓ Finalize Plan]             │
│                                                                 │
│  ┌────────────────────────────────────────┬──────────────────┐ │
│  │  💬 Discussion: Issue #123             │  📄 Living Doc   │ │
│  │  Issue: Bug in SQL executor            │  ─────────────── │ │
│  │                                        │                  │ │
│  │  ───────────────────────────────────── │  ## Approach     │ │
│  │                                        │  1. Fix parser   │ │
│  │  @pm: Let's prioritize this...         │  2. Add tests    │ │
│  │  10:00 AM                              │                  │ │
│  │                                        │  ## Files        │ │
│  │  @ai: I'll analyze the code...         │  - parser.go     │ │
│  │  [Fetched pkg/sql/parser.go]           │  - executor.go   │ │
│  │  10:01 AM                              │                  │ │
│  │                                        │  ## Open Qs      │ │
│  │  @ai: The issue appears to be in...    │  - Test scope?   │ │
│  │  10:02 AM                              │                  │ │
│  │                                        │  [Updated 2m ago]│ │
│  │  @designer: Here's the mockup...       │                  │ │
│  │  [Attached: mockup.png]                │  ─────────────── │ │
│  │  10:15 AM                              │  🤖 AI Judge     │ │
│  │                                        │  Missing: error  │ │
│  │  @engineer: Can you check if...        │  handling reqs   │ │
│  │  @ai                                   │                  │ │
│  │  10:20 AM                              │  Ask @pm?        │ │
│  │                                        │                  │ │
│  │  @ai: Looking at the error...          │                  │ │
│  │  [Fetched pkg/sql/error.go]            │                  │ │
│  │  10:21 AM                              │                  │ │
│  │                                        │                  │ │
│  │  ───────────────────────────────────── │                  │ │
│  │  [Type message...]  [@ Mention] [Send] │                  │ │
│  └────────────────────────────────────────┴──────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Control Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Dashboard    Issues    Agents    [User Avatar ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🤖 Agent Control Panel                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Active Agent Runs                                      │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ Issue #123  │ Planning  │ Started: 2m ago        │  │   │
│  │  │ Bug fix...  │ 🟡        │ By: @engineer          │  │   │
│  │  │             │             │ [View] [Cancel]        │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ Issue #122  │ Coding    │ Started: 15m ago       │  │   │
│  │  │ Feature...  │ 🟢        │ Branch: agent/122      │  │   │
│  │  │             │             │ [View] [Cancel]        │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Recent Completed Runs                                  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ Issue #120  │ ✅ Completed │ PR #456 created      │  │   │
│  │  │ Refactor... │ 30m ago      │ Tests: Passed        │  │   │
│  │  │             │              │ [View PR] [View Log] │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Detail/Log View Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Dashboard    Issues    Agents    [User Avatar ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [← Back to agents]                                            │
│                                                                 │
│  🤖 Agent Run: Issue #123 - Bug fix in SQL executor            │
│  Status: 🟢 Coding    Started: 15m ago    By: @engineer         │
│  Branch: agent/issue-123-fix                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Implementation Plan                                    │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Summary: Fix null pointer in SQL executor              │   │
│  │  Files: pkg/sql/executor.go, pkg/sql/executor_test.go   │   │
│  │  Tests: Add test for null input handling                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Live Logs                                        [⏸]   │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  [10:00:00] ℹ️  Starting agent run                      │   │
│  │  [10:00:02] ℹ️  Generated implementation plan           │   │
│  │  [10:00:05] ℹ️  Status: planning → coding               │   │
│  │  [10:00:10] ℹ️  Reading file: pkg/sql/executor.go       │   │
│  │  [10:00:12] ℹ️  Analyzing function: ExecuteQuery        │   │
│  │  [10:00:15] ✏️  Generating fix for null pointer         │   │
│  │  [10:00:20] ✏️  Writing file: pkg/sql/executor.go       │   │
│  │  [10:00:25] ℹ️  Running tests...                        │   │
│  │  [10:01:00] ✅ Tests passed (45/45)                     │   │
│  │  [10:01:05] ℹ️  Creating branch: agent/issue-123-fix    │   │
│  │  [10:01:10] ✏️  Committing changes                      │   │
│  │  [10:01:15] ⏳ Creating PR...                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [🛑 Stop Agent]  [👁️ View Branch]  [📋 Copy Logs]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### IssueCard

Displays an issue in a list view with AI enrichment.

**Props:**

```typescript
interface IssueCardProps {
  issue: Issue;
  showAiSummary?: boolean;
  compact?: boolean;
  onClick?: () => void;
}
```

### AiBadge

Shows AI-generated classification.

**Props:**

```typescript
interface AiBadgeProps {
  type?: 'bug' | 'feature' | 'task' | 'question';
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  size?: 'sm' | 'md';
}
```

### DiscussionThread

Chat interface with message bubbles and AI context.

**Props:**

```typescript
interface DiscussionThreadProps {
  discussion: Discussion;
  currentUser: User;
  onSendMessage: (content: string) => void;
  onMention: (username: string) => void;
  synthesizedDocument?: string;
}
```

### LivingDocument

Side panel showing AI-synthesized plan.

**Props:**

```typescript
interface LivingDocumentProps {
  content: string;
  lastUpdated: Date;
  isFinalized: boolean;
  onFinalize?: () => void;
}
```

### AgentStatusBadge

Shows current agent run status with color coding.

**Props:**

```typescript
interface AgentStatusBadgeProps {
  status: AgentStatus;
  showLabel?: boolean;
  pulse?: boolean;  // Animate when active
}
```

### ActivityFeed

Scrollable feed of recent activities.

**Props:**

```typescript
interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}
```

---

## Responsive Breakpoints

- **Mobile**: < 640px - Single column, drawer navigation
- **Tablet**: 640px - 1024px - Two columns where applicable
- **Desktop**: > 1024px - Full layout as designed

---

## Animations

### Agent Status Indicator

- Pulse animation when status is 'planning', 'coding', or 'testing'
- Duration: 2s infinite
- Color: Match status color

### New Message

- Slide in from bottom
- Duration: 200ms
- Easing: ease-out

### Page Transitions

- Fade in
- Duration: 150ms
- Easing: ease-in-out

### Toast Notifications

- Slide in from right
- Duration: 300ms
- Auto-dismiss: 5s
