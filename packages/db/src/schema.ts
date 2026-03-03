import {
  bigint,
  boolean,
  customType,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// MatrixOne transmits boolean columns as VARCHAR "true"/"false" strings
// instead of TINYINT 1/0 used by standard MySQL.  This custom type wraps
// the built-in boolean column so Drizzle maps the values correctly.
const moBoolean = customType<{
  data: boolean;
  driverData: unknown;
}>({
  dataType() {
    return "boolean";
  },
  fromDriver(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value === "true" || value === "1";
    return false;
  },
  toDriver(value) {
    return value;
  },
});

export const AGENT_STATUS_VALUES = [
  "planning",
  "coding",
  "testing",
  "review",
  "cancelled",
  "completed",
  "failed",
] as const;

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  role: mysqlEnum("role", ["engineer", "pm", "designer", "operator"])
    .default("engineer")
    .notNull(),
  preferences: json("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const repositories = mysqlTable("repositories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  owner: varchar("owner", { length: 100 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isPrivate: moBoolean("is_private").default(false).notNull(),
  defaultBranch: varchar("default_branch", { length: 100 })
    .default("main")
    .notNull(),
  aiConfig: json("ai_config"),
  syncEnabled: moBoolean("sync_enabled").default(true).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const issues = mysqlTable("issues", {
  id: varchar("id", { length: 36 }).primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  number: int("number").notNull(),
  repoOwner: varchar("repo_owner", { length: 100 }).notNull(),
  repoName: varchar("repo_name", { length: 100 }).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  state: mysqlEnum("state", ["open", "closed"]).notNull(),
  labels: json("labels"),
  assigneeGithubId: bigint("assignee_github_id", { mode: "number" }),
  aiType: mysqlEnum("ai_type", ["bug", "feature", "task", "question"]),
  aiPriority: mysqlEnum("ai_priority", ["P0", "P1", "P2", "P3"]),
  aiSummary: varchar("ai_summary", { length: 500 }),
  aiTags: json("ai_tags"),
  aiAnalysis: json("ai_analysis"),
  duplicateOf: int("duplicate_of"),
  relatedIssues: json("related_issues"),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const agentRuns = mysqlTable("agent_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  issueId: varchar("issue_id", { length: 36 }).notNull(),
  startedBy: varchar("started_by", { length: 36 }).notNull(),
  status: mysqlEnum("status", AGENT_STATUS_VALUES).notNull(),
  plan: json("plan"),
  branch: varchar("branch", { length: 200 }),
  prNumber: int("pr_number"),
  logs: json("logs"),
  artifacts: json("artifacts"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const discussions = mysqlTable("discussions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  issueId: varchar("issue_id", { length: 36 }).notNull(),
  type: mysqlEnum("type", ["issue_chat", "plan_review", "code_review"])
    .default("issue_chat")
    .notNull(),
  participants: json("participants"),
  synthesizedDocument: text("synthesized_document"),
  lastSynthesizedAt: timestamp("last_synthesized_at"),
  finalized: moBoolean("finalized").default(false).notNull(),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  discussionId: varchar("discussion_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }),
  authorType: mysqlEnum("author_type", ["user", "ai", "system"]).notNull(),
  content: text("content").notNull(),
  aiContext: json("ai_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ACTIVITY_TYPE_VALUES = [
  "issue_created",
  "issue_updated",
  "issue_closed",
  "agent_started",
  "agent_completed",
  "agent_failed",
  "pr_created",
  "pr_merged",
  "plan_generated",
  "plan_finalized",
  "comment_added",
] as const;

export const activityLog = mysqlTable("activity_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  type: mysqlEnum("type", ACTIVITY_TYPE_VALUES).notNull(),
  repoOwner: varchar("repo_owner", { length: 100 }),
  repoName: varchar("repo_name", { length: 100 }),
  issueNumber: int("issue_number"),
  agentRunId: varchar("agent_run_id", { length: 36 }),
  actorId: varchar("actor_id", { length: 36 }),
  actorType: mysqlEnum("actor_type", ["user", "ai", "system"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookEvents = mysqlTable("webhook_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  source: varchar("source", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  payload: json("payload").notNull(),
  processed: moBoolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const codeContextCache = mysqlTable("code_context_cache", {
  id: varchar("id", { length: 36 }).primaryKey(),
  repoOwner: varchar("repo_owner", { length: 100 }).notNull(),
  repoName: varchar("repo_name", { length: 100 }).notNull(),
  issueNumber: int("issue_number").notNull(),
  queryHash: varchar("query_hash", { length: 64 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  lineStart: int("line_start"),
  lineEnd: int("line_end"),
  snippet: text("snippet"),
  relevanceScore: float("relevance_score"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const issueEmbeddings = mysqlTable("issue_embeddings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  issueId: varchar("issue_id", { length: 36 }).notNull(),
  embeddingType: mysqlEnum("embedding_type", ["title", "body", "summary"]).notNull(),
  embedding: json("embedding"),
  model: varchar("model", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pullRequests = mysqlTable("pull_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  number: int("number").notNull(),
  repoOwner: varchar("repo_owner", { length: 100 }).notNull(),
  repoName: varchar("repo_name", { length: 100 }).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  state: mysqlEnum("state", ["open", "closed", "merged"]).notNull(),
  headBranch: varchar("head_branch", { length: 200 }).notNull(),
  baseBranch: varchar("base_branch", { length: 200 }).notNull(),
  authorGithubId: bigint("author_github_id", { mode: "number" }),
  linkedIssueNumbers: json("linked_issue_numbers"), // number[]
  additions: int("additions"),
  deletions: int("deletions"),
  changedFiles: int("changed_files"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  mergedAt: timestamp("merged_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});
