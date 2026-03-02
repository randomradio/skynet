# Implementation Phases

## Overview

The MVP is implemented in 5 phases over approximately 10 weeks. Each phase builds on the previous, delivering working functionality incrementally.

---

## Phase 1: Foundation (Weeks 1-2)

### Goals
- Set up the Next.js project structure
- Configure database connection to MatrixOne
- Implement GitHub OAuth authentication
- Create basic dashboard layout

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Project Setup | Next.js 15 + TypeScript + Tailwind + shadcn/ui |
| Database Layer | MatrixOne connection, schema migration, basic queries |
| Auth System | GitHub OAuth, JWT handling, protected routes |
| Layout Shell | Header, navigation, sidebar structure |

### Technical Tasks

1. **Initialize Next.js Project**
   ```bash
   npx create-next-app@latest web --typescript --tailwind --app --src-dir
   cd web
   npx shadcn-ui@latest init
   ```

2. **Database Setup**
   - Create connection pool to MatrixOne
   - Run schema migrations
   - Implement basic CRUD operations

3. **Authentication**
   - Configure NextAuth.js with GitHub provider
   - Create login/logout flows
   - Protect API routes and pages

4. **Base Layout**
   - Header with navigation
   - Responsive sidebar
   - Theme provider (light/dark)

### Success Criteria
- [ ] Can log in with GitHub
- [ ] Database connection works
- [ ] Protected routes redirect to login
- [ ] Responsive layout renders correctly

---

## Phase 2: Issue Management (Weeks 3-4)

### Goals
- Sync issues from GitHub
- Display issue list and detail views
- Implement AI analysis integration
- Create activity feed

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| GitHub Sync | Webhook handlers, issue sync, incremental updates |
| Issue List | Filterable, sortable list with AI summaries |
| Issue Detail | Full issue view with AI analysis panel |
| Activity Feed | Real-time feed of platform activities |

### Technical Tasks

1. **GitHub Integration**
   - Webhook endpoint for issue events
   - Background sync job
   - Rate limit handling

2. **Issue List Page**
   - Table/grid view
   - Filters (state, type, priority, assignee)
   - Pagination
   - Search

3. **Issue Detail Page**
   - GitHub issue content
   - AI analysis panel
   - Related issues
   - Action buttons

4. **AI Analysis**
   - Trigger analysis on issue open
   - Store results in database
   - Display in UI

5. **Activity Feed**
   - Database triggers for activity logging
   - Feed component
   - Real-time updates via WebSocket

### Success Criteria
- [ ] Issues sync from GitHub automatically
- [ ] Can view issue list with AI summaries
- [ ] Can view issue detail with AI analysis
- [ ] Activity feed shows recent events
- [ ] AI analysis completes within 30 seconds

---

## Phase 3: Discussion & Collaboration (Weeks 5-6)

### Goals
- Implement discussion/threads around issues
- AI participation in discussions
- Living document that updates automatically
- Finalization workflow

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Discussion UI | Chat interface with message threading |
| AI Chat Integration | AI responds to messages, fetches code |
| Living Document | Auto-updating synthesized plan |
| Finalization | Lock document, mark ready for execution |

### Technical Tasks

1. **Discussion Data Model**
   - Create discussions table
   - Create messages table
   - Link to issues

2. **Chat Interface**
   - Message bubbles
   - Mention support (@username)
   - Code block rendering
   - File attachments

3. **AI Participation**
   - AI responds when mentioned or relevant
   - Fetches code context on demand
   - Maintains conversation state

4. **Living Document**
   - Side panel showing synthesized content
   - Updates after significant discussion
   - Markdown rendering

5. **Finalization**
   - "Finalize" button
   - Lock discussion
   - Generate final plan
   - Enable execution

### Success Criteria
- [ ] Can start discussion on any issue
- [ ] AI responds intelligently in chat
- [ ] AI fetches relevant code when asked
- [ ] Living document updates automatically
- [ ] Can finalize plan for execution

---

## Phase 4: AIOSandbox Agent Runtime (Weeks 7-8)

### Goals
- AIOSandbox integration for isolated agent execution
- Implementation plan generation
- Real-time agent progress streaming via WebSocket
- Iteration policy with lint/test loops
- PR creation and linking

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Sandbox Manager | Provision/destroy AIOSandbox instances |
| Agent Runtime | Node.js runtime in sandbox containers |
| MCP Integration | Sandbox-side tools (filesystem, terminal, git) |
| Iteration Engine | Lint/test loops with defined policies |
| WebSocket Bridge | Stream logs from sandbox to platform |
| PR Workflow | Automatic PR generation and linking |

### Technical Tasks

1. **AIOSandbox Integration**
   - Sandbox provisioning API
   - Container lifecycle management
   - SSH/API connection to sandbox
   - Resource monitoring

2. **Agent Runtime (in Sandbox)**
   - Node.js agent process
   - MCP client setup
   - GitHub CLI integration
   - Rules file (AGENTS.md) loading

3. **Iteration Policy Implementation**
   - Lint check with auto-fix (max 3 iterations)
   - Type check with auto-fix (max 3 iterations)
   - Local test run (1 attempt, analyze on failure)
   - Build check (max 2 iterations)
   - Handoff to human on persistent failures

4. **WebSocket Bridge**
   - Stream sandbox logs to platform
   - Real-time status updates
   - Connection resilience

5. **PR Workflow**
   - Create branch in sandbox
   - Commit changes
   - Push to remote
   - Open PR via GitHub CLI
   - Link to issue

### Success Criteria
- [ ] Can provision AIOSandbox from platform
- [ ] Agent executes in isolated environment
- [ ] Lint/test iterations follow defined policy
- [ ] Logs stream to platform in real-time
- [ ] PR created automatically on success
- [ ] Failed runs hand off to human with context

---

## Phase 5: Integration & Polish (Weeks 9-10)

### Goals
- Role-based views (PM, Engineer, Designer, Ops)
- Notifications
- Performance optimization
- User onboarding

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| Role-Based UI | Customized views per role |
| Notifications | Email and in-app notifications |
| Performance | Query optimization, caching |
| Onboarding | First-time user experience |

### Technical Tasks

1. **Role-Based Views**
   - PM: Roadmap, customer impact
   - Engineer: Agents, code changes
   - Designer: UI/UX issues, mockups
   - Ops: Deployment status

2. **Notifications**
   - Email integration
   - Webhook support
   - In-app notification center
   - Mention notifications

3. **Performance**
   - Database query optimization
   - Redis caching layer
   - Pagination improvements
   - Lazy loading

4. **Onboarding**
   - Welcome flow
   - First repository setup
   - Tutorial tooltips
   - Documentation links

### Success Criteria
- [ ] Role selection on first login
- [ ] Dashboard shows relevant content per role
- [ ] Notifications sent for mentions and updates
- [ ] Page load times under 2 seconds
- [ ] New users can complete onboarding in 5 minutes

---

## MVP Feature Summary

| Feature | Phase | Priority |
|---------|-------|----------|
| GitHub OAuth | 1 | P0 |
| Database schema | 1 | P0 |
| Issue sync | 2 | P0 |
| Issue list/detail | 2 | P0 |
| AI analysis | 2 | P0 |
| Activity feed | 2 | P1 |
| Discussion/Chat | 3 | P0 |
| AI participation | 3 | P0 |
| Living document | 3 | P0 |
| Plan finalization | 3 | P1 |
| Agent runtime | 4 | P0 |
| Real-time streaming | 4 | P0 |
| PR creation | 4 | P1 |
| Role-based views | 5 | P1 |
| Notifications | 5 | P1 |
| Performance | 5 | P2 |
| Onboarding | 5 | P2 |

---

## Dependencies Between Phases

```
Phase 1 (Foundation)
    ↓
Phase 2 (Issues) ──→ GitHub sync
    ↓                    ↓
Phase 3 (Discussion) ←──┘
    ↓
Phase 4 (AIOSandbox)
    ↓
Phase 5 (Polish)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Phase overruns | Weekly check-ins, scope cutting |
| GitHub rate limits | Implement caching early |
| AI reliability | Fallback to human, clear error states |
| MatrixOne limitations | Keep schema simple, avoid advanced features |
| AIOSandbox security | Container isolation, network policies, resource limits |

---

## Success Metrics by Phase

### Phase 1
- Project builds and deploys
- Auth flow works end-to-end

### Phase 2
- Issue sync completes within 5 minutes for 1000 issues
- AI analysis generates for 90% of issues

### Phase 3
- Discussions support 10+ participants
- AI responds within 5 seconds
- Living document updates after every 3 messages

### Phase 4
- Agent completes simple task in under 10 minutes
- 80% of agents complete without human intervention
- PR creation succeeds 95% of the time

### Phase 5
- User onboarding completion rate > 80%
- Page load time < 2 seconds
- Daily active users across all roles
