CREATE TABLE IF NOT EXISTS loan_products (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_km TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'short_term',
  currency TEXT NOT NULL DEFAULT 'USD',
  min_cents INTEGER NOT NULL,
  max_cents INTEGER NOT NULL,
  terms_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, code),
  FOREIGN KEY(tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS loan_product_versions (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  change_reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(product_id, version),
  FOREIGN KEY(product_id) REFERENCES loan_products(id),
  FOREIGN KEY(tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS loan_product_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(product_id) REFERENCES loan_products(id),
  FOREIGN KEY(tenant_id) REFERENCES team_companies(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS loan_products_tenant_status ON loan_products(tenant_id, status);
CREATE INDEX IF NOT EXISTS loan_product_versions_tenant_product ON loan_product_versions(tenant_id, product_id, version);
CREATE INDEX IF NOT EXISTS loan_product_reviews_tenant_product ON loan_product_reviews(tenant_id, product_id, version);
