ALTER TABLE team_audit ADD COLUMN seq INTEGER;
--> statement-breakpoint
UPDATE team_audit SET seq=(SELECT rn FROM (SELECT id,ROW_NUMBER() OVER (ORDER BY created_at,id) rn FROM team_audit) x WHERE x.id=team_audit.id);
--> statement-breakpoint
CREATE UNIQUE INDEX team_audit_seq_unique ON team_audit(seq) WHERE seq IS NOT NULL;
--> statement-breakpoint
ALTER TABLE team_audit_manifests ADD COLUMN version INTEGER NOT NULL DEFAULT 2;
--> statement-breakpoint
ALTER TABLE team_audit_manifests ADD COLUMN last_seq INTEGER;
--> statement-breakpoint
CREATE INDEX team_audit_manifests_tenant_version ON team_audit_manifests (tenant_id, version, created_at);
--> statement-breakpoint
DROP TRIGGER IF EXISTS team_audit_no_update;
--> statement-breakpoint
CREATE TRIGGER team_audit_no_update BEFORE UPDATE ON team_audit
BEGIN SELECT RAISE(ABORT, 'team_audit is append-only'); END;
