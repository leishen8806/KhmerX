ALTER TABLE kyc_files ADD COLUMN superseded_at TEXT;
CREATE INDEX kyc_files_active_slot ON kyc_files (owner, customer_id, slot, superseded_at, ready);
