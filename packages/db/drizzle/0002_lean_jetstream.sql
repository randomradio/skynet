CREATE TABLE `pull_requests` (
	`id` varchar(36) NOT NULL,
	`github_id` bigint NOT NULL,
	`number` int NOT NULL,
	`repo_owner` varchar(100) NOT NULL,
	`repo_name` varchar(100) NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`state` enum('open','closed','merged') NOT NULL,
	`head_branch` varchar(200) NOT NULL,
	`base_branch` varchar(200) NOT NULL,
	`author_github_id` bigint,
	`linked_issue_numbers` json,
	`additions` int,
	`deletions` int,
	`changed_files` int,
	`created_at` timestamp,
	`updated_at` timestamp,
	`merged_at` timestamp,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pull_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `pull_requests_github_id_unique` UNIQUE(`github_id`)
);
--> statement-breakpoint
ALTER TABLE `agent_runs` MODIFY COLUMN `issue_id` varchar(36);--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `author_type` enum('user','ai','system') NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `mode` enum('develop','review') DEFAULT 'develop' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_runs` ADD `pull_request_id` varchar(36);