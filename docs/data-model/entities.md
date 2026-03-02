# Data Model - Core Entities

## Issue

The central entity representing a GitHub issue with AI enrichment.

```typescript
interface Issue {
  // Primary identifiers
  id: string;                    // UUID v4
  githubId: number;              // GitHub's issue ID
  number: number;                // Issue number in repo
  repoOwner: string;             // Repository owner
  repoName: string;              // Repository name

  // Core content (from GitHub)
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Label[];
  assignee?: User;

  // AI-enriched fields
  aiType?: 'bug' | 'feature' | 'task' | 'question';
  aiPriority?: 'P0' | 'P1' | 'P2' | 'P3';
  aiSummary?: string;            // Concise AI-generated summary
  aiTags?: string[];             // Auto-generated tags
  aiAnalysis?: IssueAnalysis;    // Detailed analysis
  duplicateOf?: number;          // Reference to duplicate issue
  relatedIssues?: number[];      // Related issue numbers

  // Sync metadata
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
  lastAnalyzedAt?: Date;
}

interface Label {
  name: string;
  color: string;
  description?: string;
}
```

## IssueAnalysis

Detailed AI-generated analysis of an issue.

```typescript
interface IssueAnalysis {
  // Implementation approach
  approach?: string;

  // Code organization
  affectedModules?: string[];
  affectedFiles?: string[];

  // Effort estimation
  estimatedComplexity?: 'small' | 'medium' | 'large';
  estimatedHours?: number;

  // Risk assessment
  blockers?: string[];
  risks?: string[];

  // Team suggestions
  suggestedAssignees?: string[];
  requiredSkills?: string[];

  // Code context
  relatedCode?: CodeReference[];
}

interface CodeReference {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  snippet: string;
  relevance: number;  // 0-1 score
}
```

## AgentRun

Tracks the execution of an AI agent for implementing an issue.

```typescript
interface AgentRun {
  // Identifiers
  id: string;
  issueId: string;
  startedBy: string;  // User ID

  // Status tracking
  status: AgentStatus;

  // Execution details
  plan?: ImplementationPlan;
  branch?: string;
  prNumber?: number;

  // Timeline
  startedAt: Date;
  completedAt?: Date;

  // Logs and output
  logs: AgentLog[];
  artifacts?: AgentArtifact[];
}

type AgentStatus =
  | 'planning'      // Generating implementation plan
  | 'coding'        // Writing code
  | 'testing'       // Running tests
  | 'review'        // Awaiting human review
  | 'completed'     // Successfully completed
  | 'failed';       // Failed (see logs)

interface AgentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

interface AgentArtifact {
  type: 'file' | 'diff' | 'test_result' | 'ci_result';
  path?: string;
  content?: string;
  url?: string;
}
```

## ImplementationPlan

AI-generated plan for implementing an issue.

```typescript
interface ImplementationPlan {
  summary: string;
  approach: string;

  // Files to modify/create
  files: PlannedFile[];

  // Testing strategy
  tests: PlannedTest[];

  // Dependencies
  dependencies: string[];

  // Risks and mitigations
  risks: Risk[];

  // Questions to resolve
  openQuestions?: string[];
}

interface PlannedFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  description: string;
  estimatedLines?: number;
}

interface PlannedTest {
  type: 'unit' | 'integration' | 'e2e';
  description: string;
  filePath?: string;
}

interface Risk {
  description: string;
  mitigation: string;
  severity: 'low' | 'medium' | 'high';
}
```

## Discussion / Thread

Chat and collaboration around issues.

```typescript
interface Discussion {
  id: string;
  issueId: string;

  // Thread type
  type: 'issue_chat' | 'plan_review' | 'code_review';

  // Participants
  participants: string[];  // User IDs

  // Messages
  messages: Message[];

  // AI synthesis
  synthesizedDocument?: string;
  lastSynthesizedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  discussionId: string;
  authorId: string;
  authorType: 'user' | 'ai';

  content: string;

  // For AI messages
  aiContext?: {
    fetchedCode?: boolean;
    referencedFiles?: string[];
  };

  createdAt: Date;
}
```

## User

Platform user (cross-functional team member).

```typescript
interface User {
  id: string;
  githubId: number;
  username: string;
  avatarUrl?: string;

  // Role in team
  role: 'engineer' | 'pm' | 'designer' | 'operator';

  // Preferences
  preferences: UserPreferences;

  // Timestamps
  createdAt: Date;
  lastLoginAt?: Date;
}

interface UserPreferences {
  notifications: {
    email: boolean;
    webhook?: string;
    mentionsOnly: boolean;
  };
  viewSettings: {
    defaultDashboard: 'org' | 'personal';
    issueListColumns: string[];
  };
}
```

## Activity

Cross-functional visibility feed.

```typescript
interface Activity {
  id: string;
  type: ActivityType;

  // Context
  repoOwner?: string;
  repoName?: string;
  issueNumber?: number;
  agentRunId?: string;

  // Actor
  actorId: string;
  actorType: 'user' | 'ai' | 'system';

  // Content
  title: string;
  description?: string;
  metadata?: Record<string, any>;

  createdAt: Date;
}

type ActivityType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_closed'
  | 'agent_started'
  | 'agent_completed'
  | 'agent_failed'
  | 'pr_created'
  | 'pr_merged'
  | 'plan_generated'
  | 'plan_finalized'
  | 'comment_added';
```

## Repository

Connected GitHub repository.

```typescript
interface Repository {
  id: string;
  owner: string;
  name: string;

  // GitHub metadata
  githubId: number;
  description?: string;
  isPrivate: boolean;
  defaultBranch: string;

  // AI configuration
  aiConfig: RepositoryAIConfig;

  // Sync state
  lastSyncedAt?: Date;
  syncEnabled: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

interface RepositoryAIConfig {
  enabled: boolean;
  autoAnalyze: boolean;
  autoDetectDuplicates: boolean;
  customPrompts?: {
    analysis?: string;
    summary?: string;
  };
}
```
