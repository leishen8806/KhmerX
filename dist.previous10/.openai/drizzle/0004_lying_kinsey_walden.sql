ALTER TABLE `team_assignments` ADD `reviewer_id` text REFERENCES team_members(id);--> statement-breakpoint
ALTER TABLE `team_companies` ADD `auto_assign` integer DEFAULT 1 NOT NULL;