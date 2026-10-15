CREATE TABLE IF NOT EXISTS team_kyc_field_permissions (
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  field_group TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, member_id, field_group),
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id),
  FOREIGN KEY (member_id) REFERENCES team_members(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_kyc_field_permissions_member ON team_kyc_field_permissions(tenant_id, member_id);
