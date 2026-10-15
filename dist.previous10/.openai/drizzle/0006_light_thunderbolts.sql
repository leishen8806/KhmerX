CREATE TABLE `kyc_contracts` (
	`signature_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`customer_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kyc_contracts_owner_customer` ON `kyc_contracts` (`owner`,`customer_id`);