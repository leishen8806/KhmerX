CREATE TABLE `telegram_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`notification_id` text NOT NULL,
	`loan_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`message_id` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_notification_once` ON `telegram_outbox` (`owner`,`notification_id`);--> statement-breakpoint
CREATE INDEX `telegram_pending` ON `telegram_outbox` (`owner`,`status`,`next_at`);--> statement-breakpoint
CREATE TABLE `telegram_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`customer_id` text NOT NULL,
	`bot_id` text NOT NULL,
	`chat_hash` text NOT NULL,
	`chat_encrypted` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_customer_channel` ON `telegram_subscriptions` (`owner`,`customer_id`,`bot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_chat_channel` ON `telegram_subscriptions` (`owner`,`bot_id`,`chat_hash`);