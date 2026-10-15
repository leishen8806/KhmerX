CREATE TABLE IF NOT EXISTS team_customer_tags (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_customer_tags_tenant ON team_customer_tags(tenant_id, active, name);
CREATE TABLE IF NOT EXISTS team_customer_tag_links (
  tenant_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, tag_id, customer_id),
  FOREIGN KEY (tenant_id) REFERENCES team_companies(id),
  FOREIGN KEY (tag_id) REFERENCES team_customer_tags(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS team_customer_tag_links_customer ON team_customer_tag_links(tenant_id, customer_id);
