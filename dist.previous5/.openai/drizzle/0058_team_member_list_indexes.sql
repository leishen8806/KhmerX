-- Support scoped employee search, role filtering and stable pagination.
CREATE INDEX IF NOT EXISTS team_members_tenant_active_email
  ON team_members (tenant_id, active, email COLLATE NOCASE, id);
CREATE INDEX IF NOT EXISTS team_members_tenant_active_role
  ON team_members (tenant_id, active, role, id);
CREATE INDEX IF NOT EXISTS team_members_tenant_active_unit
  ON team_members (tenant_id, active, unit_id, id);
