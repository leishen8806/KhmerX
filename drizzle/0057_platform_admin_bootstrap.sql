-- One-time platform bootstrap for the initial second company administrator.
-- The target must complete SSO binding with the exact verified email before expiry.
CREATE TABLE IF NOT EXISTS team_platform_bootstrap (
  member_id TEXT PRIMARY KEY NOT NULL REFERENCES team_members(id),
  tenant_id TEXT NOT NULL REFERENCES team_companies(id),
  email TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS team_platform_bootstrap_email
  ON team_platform_bootstrap(lower(email), expires_at, used_at);
