CREATE TABLE IF NOT EXISTS team_notification_templates (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, event_key, locale)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_notification_templates_tenant ON team_notification_templates(tenant_id, event_key);
