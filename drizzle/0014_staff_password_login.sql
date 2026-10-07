CREATE TABLE team_staff_credentials (member_id TEXT PRIMARY KEY REFERENCES team_members(id), password_hash TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE team_staff_sessions (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES team_members(id), site_user_id TEXT NOT NULL, member_version INTEGER NOT NULL, credential_version INTEGER NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX team_staff_sessions_expiry ON team_staff_sessions(expires_at);
--> statement-breakpoint
CREATE TABLE team_staff_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
--> statement-breakpoint
-- UAT staff and password credentials are no longer provisioned by migrations.
--> statement-breakpoint
-- Create staff through the protected Admin flow with an explicit password reset.
--> statement-breakpoint
-- No hardcoded password hashes.
--> statement-breakpoint
-- No hardcoded UAT members.
--> statement-breakpoint
-- No hardcoded password hashes.
--> statement-breakpoint
-- UAT initialization audit is intentionally omitted.
