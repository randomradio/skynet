-- Add interactive terminal support to agent_runs

ALTER TABLE `agent_runs` MODIFY COLUMN `mode` ENUM('develop','review','interactive') NOT NULL DEFAULT 'develop';
--> statement-breakpoint
ALTER TABLE `agent_runs` MODIFY COLUMN `status` ENUM('planning','coding','testing','review','waiting_for_input','cancelled','completed','failed') NOT NULL;
--> statement-breakpoint
ALTER TABLE `agent_runs` ADD COLUMN `bash_session_id` VARCHAR(100);
--> statement-breakpoint
ALTER TABLE `agent_runs` ADD COLUMN `terminal_output` MEDIUMTEXT;
--> statement-breakpoint
ALTER TABLE `agent_runs` ADD COLUMN `waiting_for_input` BOOLEAN NOT NULL DEFAULT false;
