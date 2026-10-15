CREATE TABLE `kyc_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`customer_id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kyc_cases_owner_customer` ON `kyc_cases` (`owner`,`customer_id`);--> statement-breakpoint
CREATE INDEX `kyc_cases_owner_status` ON `kyc_cases` (`owner`,`status`);--> statement-breakpoint
CREATE TABLE `kyc_files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`customer_id` text NOT NULL,
	`slot` text NOT NULL,
	`metadata` text NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kyc_files_owner_customer` ON `kyc_files` (`owner`,`customer_id`);--> statement-breakpoint
CREATE TABLE `kyc_history` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`revision` integer NOT NULL,
	`owner` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kyc_history_case_revision` ON `kyc_history` (`case_id`,`revision`);