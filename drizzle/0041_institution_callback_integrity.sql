ALTER TABLE institution_callback_events ADD COLUMN event_id TEXT;
ALTER TABLE institution_callback_events ADD COLUMN payload_hash TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS institution_callback_event_identity ON institution_callback_events (institution_id, event_id) WHERE event_id IS NOT NULL;
