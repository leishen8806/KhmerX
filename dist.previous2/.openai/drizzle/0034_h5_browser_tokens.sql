CREATE TABLE h5_browser_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX h5_browser_tokens_expiry ON h5_browser_tokens (expires_at);
