import {
  bigint,
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

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
  isPrivate: boolean("is_private").default(false).notNull(),
  defaultBranch: varchar("default_branch", { length: 100 })
    .default("main")
    .notNull(),
  syncEnabled: boolean("sync_enabled").default(true).notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  discussionId: varchar("discussion_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }),
  authorType: mysqlEnum("author_type", ["user", "ai"]).notNull(),
  content: text("content").notNull(),
  aiContext: json("ai_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
