CREATE TABLE IF NOT EXISTS public_identifiers (
  ref TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  tenant_id TEXT,
  source_channel TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS public_identifiers_entity_internal
  ON public_identifiers(entity_type, internal_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS public_identifiers_tenant
  ON public_identifiers(tenant_id, entity_type, created_at);
--> statement-breakpoint
ALTER TABLE h5_accounts ADD COLUMN customer_ref TEXT;
--> statement-breakpoint
ALTER TABLE h5_accounts ADD COLUMN source_channel TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS h5_accounts_customer_ref_unique
  ON h5_accounts(customer_ref) WHERE customer_ref IS NOT NULL;
--> statement-breakpoint
ALTER TABLE kyc_cases ADD COLUMN public_ref TEXT;
--> statement-breakpoint
ALTER TABLE kyc_cases ADD COLUMN source_channel TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS kyc_cases_public_ref_unique
  ON kyc_cases(public_ref) WHERE public_ref IS NOT NULL;
--> statement-breakpoint
ALTER TABLE kyc_files ADD COLUMN public_ref TEXT;
--> statement-breakpoint
ALTER TABLE kyc_files ADD COLUMN source_channel TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS kyc_files_public_ref_unique
  ON kyc_files(public_ref) WHERE public_ref IS NOT NULL;
--> statement-breakpoint
ALTER TABLE team_service_tickets ADD COLUMN public_ref TEXT;
--> statement-breakpoint
ALTER TABLE team_service_tickets ADD COLUMN source_channel TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS team_service_tickets_public_ref_unique
  ON team_service_tickets(public_ref) WHERE public_ref IS NOT NULL;
--> statement-breakpoint
ALTER TABLE team_audit ADD COLUMN public_ref TEXT;
--> statement-breakpoint
ALTER TABLE team_audit ADD COLUMN source_channel TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS team_audit_public_ref_unique
  ON team_audit(public_ref) WHERE public_ref IS NOT NULL;
