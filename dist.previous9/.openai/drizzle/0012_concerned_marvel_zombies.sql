CREATE TABLE `telegram_bot_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`bot_id` text NOT NULL,
	`telegram_id` text NOT NULL,
	`label` text NOT NULL,
	`username` text NOT NULL,
	`token_encrypted` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_bot_owner_channel` ON `telegram_bot_credentials` (`owner`,`bot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_bot_identity` ON `telegram_bot_credentials` (`telegram_id`);