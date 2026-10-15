ALTER TABLE team_mfa_challenges ADD COLUMN consumed_at INTEGER;
--> statement-breakpoint
CREATE INDEX team_mfa_challenge_consumed ON team_mfa_challenges (token_hash, consumed_at);
