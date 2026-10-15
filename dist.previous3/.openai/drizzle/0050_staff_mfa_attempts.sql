ALTER TABLE team_mfa_challenges ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX team_mfa_challenge_attempts ON team_mfa_challenges (member_id, attempts, expires_at);
