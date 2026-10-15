CREATE TABLE team_audit_manifests (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  first_created_at TEXT,
  last_created_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX team_audit_manifests_tenant_date ON team_audit_manifests (tenant_id, created_at);
--> statement-breakpoint
CREATE TRIGGER team_audit_manifests_no_update BEFORE UPDATE ON team_audit_manifests BEGIN SELECT RAISE(ABORT, 'team_audit_manifests is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER team_audit_manifests_no_delete BEFORE DELETE ON team_audit_manifests BEGIN SELECT RAISE(ABORT, 'team_audit_manifests is append-only'); END;
