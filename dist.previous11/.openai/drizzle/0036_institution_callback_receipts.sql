CREATE TABLE IF NOT EXISTS institution_callback_nonces (
  institution_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (institution_id, nonce)
);
CREATE INDEX IF NOT EXISTS institution_callback_nonces_expiry ON institution_callback_nonces (expires_at);
CREATE TABLE IF NOT EXISTS institution_callback_events (
  id TEXT PRIMARY KEY NOT NULL,
  institution_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (institution_id, idempotency_key)
);
