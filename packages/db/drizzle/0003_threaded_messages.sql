ALTER TABLE `messages` ADD COLUMN `parent_id` varchar(36) DEFAULT NULL;
ALTER TABLE `messages` ADD COLUMN `thread_count` int DEFAULT 0;
