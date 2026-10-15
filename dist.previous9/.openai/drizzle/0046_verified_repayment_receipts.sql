ALTER TABLE team_repayment_receipts ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
CREATE INDEX team_repayment_receipts_verified ON team_repayment_receipts (tenant_id, reference, verified);
