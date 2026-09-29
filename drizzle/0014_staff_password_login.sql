CREATE TABLE team_staff_credentials (member_id TEXT PRIMARY KEY REFERENCES team_members(id), password_hash TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE team_staff_sessions (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES team_members(id), site_user_id TEXT NOT NULL, member_version INTEGER NOT NULL, credential_version INTEGER NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX team_staff_sessions_expiry ON team_staff_sessions(expires_at);
--> statement-breakpoint
CREATE TABLE team_staff_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO team_units (id,tenant_id,name,kind) SELECT 'uat-approval:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b',id,'UAT 测试审批机构','institution' FROM team_companies WHERE id='t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b' AND slug='uat-company-b';
--> statement-breakpoint
INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) SELECT 'uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b',id,'local:uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','b-institution-lender@example.test','lender','uat-approval:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b',1,0 FROM team_companies WHERE id='t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b' AND slug='uat-company-b';
--> statement-breakpoint
INSERT INTO team_staff_credentials (member_id,password_hash) SELECT id,'0688fd52af261710bdf8a14ebc2a5f9e208c1ee1c8e44d6c56be7a282cc2bcc2:838b9999b05a4bad071ee545cbce2b0efecce0aab2f28a5714c95c64fa5cfc88' FROM team_members WHERE id='uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b';
--> statement-breakpoint
INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) SELECT 'uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b',id,'local:uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','b-institution-checker@example.test','checker','uat-approval:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b',1,0 FROM team_companies WHERE id='t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b' AND slug='uat-company-b';
--> statement-breakpoint
INSERT INTO team_staff_credentials (member_id,password_hash) SELECT id,'6ac665e78907a106311754bb45ba1278ee47c820a243e0c197a0314444327d0b:b23875986cddd858b586e556905ff7effc9fac7c90feb2d4706a34e60e7e438c' FROM team_members WHERE id='uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b';
--> statement-breakpoint
INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT 'uat-staff-init-v55',id,'deployment','create_test_staff','{"institution":"UAT 测试审批机构","roles":["lender","checker"]}',datetime('now') FROM team_companies WHERE id='t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b' AND slug='uat-company-b';
