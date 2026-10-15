ALTER TABLE team_members ADD COLUMN locale TEXT NOT NULL DEFAULT 'zh';
CREATE INDEX IF NOT EXISTS team_members_tenant_locale ON team_members(tenant_id, locale);
