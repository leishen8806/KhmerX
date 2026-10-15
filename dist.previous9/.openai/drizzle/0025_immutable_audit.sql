CREATE TRIGGER IF NOT EXISTS team_audit_no_update
BEFORE UPDATE ON team_audit
BEGIN
  SELECT RAISE(ABORT, 'team_audit is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS team_audit_no_delete
BEFORE DELETE ON team_audit
BEGIN
  SELECT RAISE(ABORT, 'team_audit is append-only');
END;
