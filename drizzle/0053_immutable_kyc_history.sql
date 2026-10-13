-- KYC history is an audit trail. Revisions may never be rewritten; draft-only
-- cleanup is retained for the disposable demo customer cleanup flow.
CREATE TRIGGER IF NOT EXISTS kyc_history_no_update
BEFORE UPDATE ON kyc_history
BEGIN
  SELECT RAISE(ABORT, 'kyc_history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS kyc_history_no_delete_submitted
BEFORE DELETE ON kyc_history
WHEN EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id=OLD.case_id AND kyc_cases.status<>'draft')
BEGIN
  SELECT RAISE(ABORT, 'submitted kyc_history is append-only');
END;
