CREATE TABLE `h5_accounts` (
	`verification_completed` integer DEFAULT 0 NOT NULL,
	`channel_id` text,
	`customer_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`phone_mask` text NOT NULL,
	`mode` text NOT NULL,
	`browser_hash` text,
	`phone_verified` integer DEFAULT 0 NOT NULL,
	`password_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `h5_accounts_owner` ON `h5_accounts` (`owner`);