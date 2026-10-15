CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  event_name TEXT NOT NULL,
  locale TEXT,
  screen TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_events_tenant_date ON analytics_events(tenant_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS analytics_events_name_date ON analytics_events(tenant_id, event_name, created_at);
--> statement-breakpoint
