CREATE TABLE `h5_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`phone_key` text NOT NULL,
	`phone_mask` text NOT NULL,
	`mode` text NOT NULL,
	`code_hash` text,
	`provider_request` text,
	`browser_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `h5_challenges_owner_browser` ON `h5_challenges` (`owner`,`browser_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `h5_challenges_owner_phone` ON `h5_challenges` (`owner`,`phone_key`);--> statement-breakpoint
CREATE INDEX `h5_challenges_owner_expiry` ON `h5_challenges` (`owner`,`expires_at`);--> statement-breakpoint
CREATE TABLE `h5_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL,
	`next_allowed` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `h5_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`customer_id` text NOT NULL,
	`phone_mask` text NOT NULL,
	`mode` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `h5_sessions_owner_expiry` ON `h5_sessions` (`owner`,`expires_at`);