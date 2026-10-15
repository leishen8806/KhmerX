CREATE TABLE IF NOT EXISTS team_funding_settings (
  tenant_id TEXT PRIMARY KEY NOT NULL,
  daily_cents INTEGER NOT NULL DEFAULT 1000000,
  monthly_cents INTEGER NOT NULL DEFAULT 3000000,
  warning_percent INTEGER NOT NULL DEFAULT 20,
  timezone TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
INSERT OR IGNORE INTO team_funding_settings(tenant_id,updated_at)
  SELECT id, datetime('now') FROM team_companies;
