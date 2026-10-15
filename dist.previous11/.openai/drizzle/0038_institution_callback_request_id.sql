ALTER TABLE institution_callback_events ADD COLUMN request_id TEXT;
CREATE INDEX IF NOT EXISTS institution_callback_events_request_id ON institution_callback_events (request_id);
