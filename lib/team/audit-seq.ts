export const AUDIT_SEQ_SQL='COALESCE((SELECT MAX(seq)+1 FROM team_audit),1)';
