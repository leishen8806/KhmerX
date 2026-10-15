ALTER TABLE `h5_accounts` ADD `credential_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `h5_challenges` ADD `purpose` text DEFAULT 'login' NOT NULL;--> statement-breakpoint
ALTER TABLE `h5_sessions` ADD `credential_version` integer DEFAULT 0 NOT NULL;