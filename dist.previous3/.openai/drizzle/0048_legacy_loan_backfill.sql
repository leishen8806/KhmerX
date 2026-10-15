CREATE TABLE legacy_loan_backfill (
  tenant_id TEXT NOT NULL,
  loan_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  kyc_case_id TEXT,
  detail TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, loan_id)
);
--> statement-breakpoint
CREATE INDEX legacy_loan_backfill_outcome ON legacy_loan_backfill (tenant_id, outcome);
