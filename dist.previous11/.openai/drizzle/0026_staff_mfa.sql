ALTER TABLE team_members ADD COLUMN mfa_secret TEXT;
--> statement-breakpoint
ALTER TABLE team_members ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE team_mfa_challenges (
  token_hash TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  site_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (member_id) REFERENCES team_members(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX team_mfa_challenge_expiry ON team_mfa_challenges (expires_at);
