CREATE TABLE team_emergency_access (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  approver_id TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  scope_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at INTEGER,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (requester_id) REFERENCES team_members(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (approver_id) REFERENCES team_members(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX team_emergency_tenant_status ON team_emergency_access (tenant_id, status, expires_at);
