ALTER TABLE team_emergency_access ADD COLUMN target_loan_id TEXT;
ALTER TABLE team_emergency_access ADD COLUMN target_cents INTEGER;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_emergency_target ON team_emergency_access (tenant_id, target_loan_id, status);
