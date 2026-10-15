ALTER TABLE team_members ADD COLUMN data_scope TEXT NOT NULL DEFAULT 'role';
--> statement-breakpoint
CREATE INDEX team_members_tenant_scope ON team_members (tenant_id, data_scope, active, id);
