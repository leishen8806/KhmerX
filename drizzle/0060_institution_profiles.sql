ALTER TABLE team_units ADD COLUMN institution_code TEXT;
--> statement-breakpoint
ALTER TABLE team_units ADD COLUMN license_number TEXT;
--> statement-breakpoint
ALTER TABLE team_units ADD COLUMN license_expires_at TEXT;
--> statement-breakpoint
ALTER TABLE team_units ADD COLUMN callback_url TEXT;
--> statement-breakpoint
ALTER TABLE team_units ADD COLUMN supported_currencies_json TEXT NOT NULL DEFAULT '["USD"]';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS team_units_institution_code
  ON team_units (tenant_id, institution_code)
  WHERE kind='institution' AND institution_code IS NOT NULL;
