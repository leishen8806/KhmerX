CREATE TABLE IF NOT EXISTS institution_callback_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  next_at INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, attempt)
);
CREATE INDEX IF NOT EXISTS institution_callback_attempts_ready ON institution_callback_attempts (status, next_at);
