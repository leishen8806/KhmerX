CREATE TABLE IF NOT EXISTS team_risk_rules (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_km TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, code),
  FOREIGN KEY(tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS team_risk_rule_versions (
  id TEXT PRIMARY KEY NOT NULL,
  rule_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  change_reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(rule_id, version),
  FOREIGN KEY(rule_id) REFERENCES team_risk_rules(id),
  FOREIGN KEY(tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS team_risk_rule_hits (
  id TEXT PRIMARY KEY NOT NULL,
  rule_id TEXT NOT NULL,
  rule_version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  loan_id TEXT,
  channel TEXT,
  input_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  trace_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(rule_id) REFERENCES team_risk_rules(id),
  FOREIGN KEY(tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_risk_rules_tenant_status ON team_risk_rules(tenant_id,status);
CREATE INDEX IF NOT EXISTS team_risk_rule_versions_tenant_rule ON team_risk_rule_versions(tenant_id,rule_id,version);
CREATE INDEX IF NOT EXISTS team_risk_rule_hits_tenant_created ON team_risk_rule_hits(tenant_id,created_at);
