CREATE TABLE IF NOT EXISTS team_uat_closure_batches (
  batch_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES team_companies(id),
  customer_id TEXT NOT NULL,
  loan_id TEXT NOT NULL,
  kyc_case_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  cleaned_at TEXT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS team_uat_closure_batches_tenant_batch
  ON team_uat_closure_batches (tenant_id, batch_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_uat_closure_batches_tenant_status
  ON team_uat_closure_batches (tenant_id, status, created_at);
