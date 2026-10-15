CREATE TABLE telegram_subscription_nonces (
  initdata_hash TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX telegram_subscription_nonces_expiry ON telegram_subscription_nonces (consumed_at);
