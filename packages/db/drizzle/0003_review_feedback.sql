CREATE TABLE `review_feedback` (
  `id` varchar(36) NOT NULL,
  `agent_run_id` varchar(36) NOT NULL,
  `finding_id` varchar(36) NOT NULL,
  `action` varchar(20) NOT NULL,
  `comment` text,
  `created_by` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `issue_code_context` (
  `id` varchar(36) NOT NULL,
  `issue_id` varchar(36) NOT NULL,
  `repo_owner` varchar(100) NOT NULL,
  `repo_name` varchar(100) NOT NULL,
  `snippets` json,
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
