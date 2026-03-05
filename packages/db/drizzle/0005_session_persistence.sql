-- Issue workspaces table
CREATE TABLE `issue_workspaces` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `issue_id` VARCHAR(36) NOT NULL,
  `status` ENUM('active','paused','completed','expired') NOT NULL DEFAULT 'paused',
  `repo_path` VARCHAR(500) NOT NULL,
  `worktree_path` VARCHAR(500) NOT NULL,
  `branch` VARCHAR(200) NOT NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `assigned_to` VARCHAR(36),
  `active_run_id` VARCHAR(36),
  `session_count` INT NOT NULL DEFAULT 1,
  `expires_at` TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add paused status to agent_runs
ALTER TABLE `agent_runs` MODIFY COLUMN `status`
  ENUM('planning','coding','testing','review','waiting_for_input','paused','cancelled','completed','failed') NOT NULL;

-- Link agent runs to workspaces
ALTER TABLE `agent_runs` ADD COLUMN `workspace_id` VARCHAR(36);
