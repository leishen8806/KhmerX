ALTER TABLE team_audit ADD COLUMN seq INTEGER;
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
WHEN NEW.id IS NOT OLD.id OR NEW.tenant_id IS NOT OLD.tenant_id OR NEW.actor IS NOT OLD.actor OR NEW.action IS NOT OLD.action OR NEW.detail IS NOT OLD.detail OR NEW.created_at IS NOT OLD.created_at OR NEW.seq IS OLD.seq OR OLD.seq IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'team_audit is append-only'); END;
