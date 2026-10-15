CREATE TABLE team_repayment_ledger (
  tenant_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  loan_id TEXT NOT NULL,
  cents INTEGER NOT NULL,
  actor TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'institution_receipt',
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, reference),
  FOREIGN KEY (tenant_id, reference) REFERENCES team_repayment_receipts(tenant_id, reference)
);
--> statement-breakpoint
INSERT OR IGNORE INTO team_repayment_ledger(tenant_id,reference,loan_id,cents,actor,source,created_at)
 SELECT tenant_id,reference,loan_id,cents,actor,'legacy_receipt',created_at FROM team_repayment_receipts;
--> statement-breakpoint
CREATE INDEX team_repayment_ledger_loan ON team_repayment_ledger (tenant_id, loan_id, created_at);
