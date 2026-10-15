CREATE TABLE customer_workspaces (
  owner TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner, customer_id)
);
--> statement-breakpoint
CREATE TABLE loan_index (
  owner TEXT NOT NULL,
  loan_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner, loan_id)
);
--> statement-breakpoint
CREATE INDEX loan_index_customer ON loan_index (owner, customer_id);
--> statement-breakpoint
CREATE INDEX loan_index_status ON loan_index (owner, status, updated_at);
