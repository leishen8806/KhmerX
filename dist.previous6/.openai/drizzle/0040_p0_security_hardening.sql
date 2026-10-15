ALTER TABLE team_members ADD COLUMN pending_mfa_secret TEXT;
ALTER TABLE team_members ADD COLUMN mfa_enroll_started_at INTEGER;
ALTER TABLE team_emergency_access ADD COLUMN consumed_at INTEGER;
ALTER TABLE team_emergency_access ADD COLUMN consumed_action TEXT;
ALTER TABLE team_emergency_access ADD COLUMN consumed_loan_id TEXT;
ALTER TABLE team_emergency_access ADD COLUMN consumed_cents INTEGER;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_emergency_active_requester ON team_emergency_access (tenant_id, requester_id, status, expires_at);
