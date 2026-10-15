CREATE TABLE telegram_initdata_nonces (
  initdata_hash TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  channel_id TEXT,
  auth_date INTEGER NOT NULL,
  consumed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX telegram_initdata_nonces_expiry ON telegram_initdata_nonces (auth_date);
