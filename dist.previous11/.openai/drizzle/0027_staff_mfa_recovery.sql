CREATE TABLE team_mfa_recovery_codes (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (member_id) REFERENCES team_members(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX team_mfa_recovery_member ON team_mfa_recovery_codes (member_id, used_at);
