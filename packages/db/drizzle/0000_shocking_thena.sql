CREATE TABLE `activity_log` (
	`id` varchar(36) NOT NULL,
	`type` enum('issue_created','issue_updated','issue_closed','agent_started','agent_completed','agent_failed','pr_created','pr_merged','plan_generated','plan_finalized','comment_added') NOT NULL,
	`repo_owner` varchar(100),
	`repo_name` varchar(100),
	`issue_number` int,
	`agent_run_id` varchar(36),
	`actor_id` varchar(36),
	`actor_type` enum('user','ai','system') NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` varchar(36) NOT NULL,
	`issue_id` varchar(36) NOT NULL,
	`started_by` varchar(36) NOT NULL,
	`status` enum('planning','coding','testing','review','cancelled','completed','failed') NOT NULL,
	`plan` json,
	`branch` varchar(200),
	`pr_number` int,
	`logs` json,
	`artifacts` json,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `code_context_cache` (
	`id` varchar(36) NOT NULL,
	`repo_owner` varchar(100) NOT NULL,
	`repo_name` varchar(100) NOT NULL,
	`issue_number` int NOT NULL,
	`query_hash` varchar(64) NOT NULL,
	`file_path` varchar(500) NOT NULL,
	`line_start` int,
	`line_end` int,
	`snippet` text,
	`relevance_score` float,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `code_context_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discussions` (
	`id` varchar(36) NOT NULL,
	`issue_id` varchar(36) NOT NULL,
	`type` enum('issue_chat','plan_review','code_review') NOT NULL DEFAULT 'issue_chat',
	`participants` json,
	`synthesized_document` text,
	`last_synthesized_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discussions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issue_embeddings` (
	`id` varchar(36) NOT NULL,
	`issue_id` varchar(36) NOT NULL,
	`embedding_type` enum('title','body','summary') NOT NULL,
	`embedding` json,
	`model` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issue_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` varchar(36) NOT NULL,
	`github_id` bigint NOT NULL,
	`number` int NOT NULL,
	`repo_owner` varchar(100) NOT NULL,
	`repo_name` varchar(100) NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`state` enum('open','closed') NOT NULL,
	`labels` json,
	`assignee_github_id` bigint,
	`ai_type` enum('bug','feature','task','question'),
	`ai_priority` enum('P0','P1','P2','P3'),
	`ai_summary` varchar(500),
	`ai_tags` json,
	`ai_analysis` json,
	`duplicate_of` int,
	`related_issues` json,
	`last_analyzed_at` timestamp,
	`created_at` timestamp,
	`updated_at` timestamp,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issues_id` PRIMARY KEY(`id`),
	CONSTRAINT `issues_github_id_unique` UNIQUE(`github_id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`discussion_id` varchar(36) NOT NULL,
	`author_id` varchar(36),
	`author_type` enum('user','ai') NOT NULL,
	`content` text NOT NULL,
	`ai_context` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` varchar(36) NOT NULL,
	`github_id` bigint NOT NULL,
	`owner` varchar(100) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`is_private` boolean NOT NULL DEFAULT false,
	`default_branch` varchar(100) NOT NULL DEFAULT 'main',
	`ai_config` json,
	`sync_enabled` boolean NOT NULL DEFAULT true,
	`last_synced_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repositories_id` PRIMARY KEY(`id`),
	CONSTRAINT `repositories_github_id_unique` UNIQUE(`github_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`github_id` bigint NOT NULL,
	`username` varchar(100) NOT NULL,
	`avatar_url` varchar(500),
	`role` enum('engineer','pm','designer','operator') NOT NULL DEFAULT 'engineer',
	`preferences` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_login_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_github_id_unique` UNIQUE(`github_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` varchar(36) NOT NULL,
	`source` varchar(50) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`payload` json NOT NULL,
	`processed` boolean NOT NULL DEFAULT false,
	`processed_at` timestamp,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`)
);
