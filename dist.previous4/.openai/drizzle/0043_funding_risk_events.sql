CREATE TABLE IF NOT EXISTS team_funding_risk_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'warning',
  snapshot_json TEXT NOT NULL,
  reason TEXT,
  correlation_id TEXT,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  resolved_at TEXT,
  actor TEXT,
  reviewer TEXT,
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_funding_risk_events_tenant_status
  ON team_funding_risk_events(tenant_id, status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_funding_risk_events_correlation
  ON team_funding_risk_events(tenant_id, correlation_id);
