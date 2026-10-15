CREATE TABLE `team_assignments` (
	`tenant_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`department_id` text NOT NULL,
	`institution_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `team_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `team_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `team_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_assignments_customer` ON `team_assignments` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `team_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `team_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_audit_tenant_date` ON `team_audit` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `team_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`default_department` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_companies_slug_unique` ON `team_companies` (`slug`);--> statement-breakpoint
CREATE TABLE `team_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`unit_id` text,
	`issuer` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `team_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `team_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issuer`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`unit_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `team_companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `team_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_identity` ON `team_members` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `team_units` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `team_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_units_tenant` ON `team_units` (`tenant_id`);