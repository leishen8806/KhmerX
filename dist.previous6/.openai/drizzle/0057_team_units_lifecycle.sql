ALTER TABLE team_units ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX team_units_tenant_active ON team_units (tenant_id,active);
