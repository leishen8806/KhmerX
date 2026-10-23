ALTER TABLE team_emergency_access ADD COLUMN target_role TEXT;
ALTER TABLE team_emergency_access ADD COLUMN target_unit_id TEXT;
ALTER TABLE team_emergency_access ADD COLUMN target_member_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_emergency_staff_target ON team_emergency_access (tenant_id, target_role, target_unit_id, target_member_id, status);
