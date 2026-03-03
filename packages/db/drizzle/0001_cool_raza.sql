ALTER TABLE `discussions` ADD `finalized` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `discussions` ADD `finalized_at` timestamp;