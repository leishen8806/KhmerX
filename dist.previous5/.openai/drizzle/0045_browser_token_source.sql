ALTER TABLE h5_browser_tokens ADD COLUMN source_hash TEXT;
CREATE INDEX h5_browser_tokens_source_created ON h5_browser_tokens (source_hash, created_at);
