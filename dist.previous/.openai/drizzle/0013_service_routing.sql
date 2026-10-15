CREATE TABLE team_service_settings (
 tenant_id TEXT PRIMARY KEY REFERENCES team_companies(id),
 auto_assign INTEGER NOT NULL DEFAULT 1,
 funding_id TEXT NOT NULL REFERENCES team_units(id),
 repayment_id TEXT NOT NULL REFERENCES team_units(id),
 collection_id TEXT NOT NULL REFERENCES team_units(id),
 version INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE team_assignments ADD COLUMN funding_institution_id TEXT REFERENCES team_units(id);
--> statement-breakpoint
ALTER TABLE team_assignments ADD COLUMN repayment_institution_id TEXT REFERENCES team_units(id);
--> statement-breakpoint
ALTER TABLE team_assignments ADD COLUMN collection_unit_id TEXT REFERENCES team_units(id);
--> statement-breakpoint
CREATE TABLE team_repayment_receipts (
 tenant_id TEXT NOT NULL REFERENCES team_companies(id),
 reference TEXT NOT NULL,
 loan_id TEXT NOT NULL,
 cents INTEGER NOT NULL,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,reference)
);
--> statement-breakpoint
INSERT INTO team_units(id,tenant_id,name,kind) SELECT 'funding:'||id,id,'放款承接机构','institution' FROM team_companies;
--> statement-breakpoint
INSERT INTO team_units(id,tenant_id,name,kind) SELECT 'repayment:'||id,id,'还款承接机构','institution' FROM team_companies;
--> statement-breakpoint
INSERT OR IGNORE INTO team_units(id,tenant_id,name,kind) SELECT 'postloan:'||id,id,'运营贷后部','postloan' FROM team_companies;
--> statement-breakpoint
INSERT INTO team_service_settings(tenant_id,funding_id,repayment_id,collection_id)
 SELECT id,'funding:'||id,'repayment:'||id,'postloan:'||id FROM team_companies;
--> statement-breakpoint
UPDATE team_assignments SET funding_institution_id='funding:'||tenant_id,repayment_institution_id='repayment:'||tenant_id,collection_unit_id='postloan:'||tenant_id,version=version+1;
--> statement-breakpoint
INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at)
 SELECT 'service-routing-init:'||id,id,'system','service_routing_init','{"auto_assign":true,"scope":"放款、还款、催收承接；不修改贷款审批机构"}',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM team_companies;

--> statement-breakpoint
CREATE TRIGGER service_assign_insert BEFORE INSERT ON team_assignments WHEN (NEW.funding_institution_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.funding_institution_id AND tenant_id=NEW.tenant_id AND kind='institution')) OR (NEW.repayment_institution_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.repayment_institution_id AND tenant_id=NEW.tenant_id AND kind='institution')) OR (NEW.collection_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.collection_unit_id AND tenant_id=NEW.tenant_id AND kind='postloan')) BEGIN SELECT RAISE(ABORT, 'tenant service scope mismatch'); END;

--> statement-breakpoint
CREATE TRIGGER service_config_insert BEFORE INSERT ON team_service_settings WHEN NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.funding_id AND tenant_id=NEW.tenant_id AND kind='institution') OR NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.repayment_id AND tenant_id=NEW.tenant_id AND kind='institution') OR NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.collection_id AND tenant_id=NEW.tenant_id AND kind='postloan') BEGIN SELECT RAISE(ABORT, 'tenant service scope mismatch'); END;

--> statement-breakpoint
CREATE TRIGGER service_assign_update BEFORE UPDATE ON team_assignments WHEN (NEW.funding_institution_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.funding_institution_id AND tenant_id=NEW.tenant_id AND kind='institution')) OR (NEW.repayment_institution_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.repayment_institution_id AND tenant_id=NEW.tenant_id AND kind='institution')) OR (NEW.collection_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.collection_unit_id AND tenant_id=NEW.tenant_id AND kind='postloan')) BEGIN SELECT RAISE(ABORT, 'tenant service scope mismatch'); END;

--> statement-breakpoint
CREATE TRIGGER service_config_update BEFORE UPDATE ON team_service_settings WHEN NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.funding_id AND tenant_id=NEW.tenant_id AND kind='institution') OR NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.repayment_id AND tenant_id=NEW.tenant_id AND kind='institution') OR NOT EXISTS(SELECT 1 FROM team_units WHERE id=NEW.collection_id AND tenant_id=NEW.tenant_id AND kind='postloan') BEGIN SELECT RAISE(ABORT, 'tenant service scope mismatch'); END;
