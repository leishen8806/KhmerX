CREATE TABLE IF NOT EXISTS company_channels (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES team_companies(id),
  type TEXT NOT NULL CHECK (type IN ('telegram_miniapp','h5','app')),
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('telegram','sms','demo')),
  phone_verification INTEGER NOT NULL DEFAULT 1 CHECK (phone_verification IN (0,1)),
  password_setup INTEGER NOT NULL DEFAULT 0 CHECK (password_setup IN (0,1)),
  languages_json TEXT NOT NULL DEFAULT '{"zh":true,"en":true,"km":true}',
  default_language TEXT NOT NULL DEFAULT 'zh' CHECK (default_language IN ('zh','en','km')),
  source_channel TEXT NOT NULL CHECK (source_channel IN ('TG','H5','AP','AD','IN','SY')),
  hosts_json TEXT NOT NULL DEFAULT '[]',
  allowed_origins_json TEXT NOT NULL DEFAULT '[]',
  entry_slug TEXT,
  otp_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  otp_max_attempts INTEGER NOT NULL DEFAULT 5,
  otp_resend_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  otp_rate_limits_json TEXT NOT NULL DEFAULT '{}',
  sms_provider TEXT,
  telegram_bot_id TEXT,
  bot_username TEXT,
  bot_telegram_id TEXT,
  mini_app_url TEXT,
  mini_app_short_name TEXT,
  webhook_url TEXT,
  webhook_secret_configured INTEGER NOT NULL DEFAULT 0 CHECK (webhook_secret_configured IN (0,1)),
  init_data_max_age_seconds INTEGER NOT NULL DEFAULT 86400,
  notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK (notifications_enabled IN (0,1)),
  telegram_token_configured INTEGER NOT NULL DEFAULT 0 CHECK (telegram_token_configured IN (0,1)),
  telegram_token_last4 TEXT,
  app_platform TEXT CHECK (app_platform IS NULL OR app_platform IN ('android','ios')),
  package_id TEXT,
  bundle_id TEXT,
  api_base_url TEXT,
  cookie_hosts_json TEXT NOT NULL DEFAULT '[]',
  min_supported_version TEXT,
  latest_version TEXT,
  download_url TEXT,
  force_upgrade INTEGER NOT NULL DEFAULT 0 CHECK (force_upgrade IN (0,1)),
  maintenance_messages_json TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT NOT NULL DEFAULT 'migration:0063',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, id),
  CHECK (type <> 'h5' OR phone_verification = 1),
  CHECK (type <> 'app' OR phone_verification = 1),
  CHECK (type <> 'telegram_miniapp' OR auth_mode = 'telegram'),
  CHECK (type <> 'app' OR app_platform IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS company_channels_tenant_type ON company_channels(tenant_id, type, enabled);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS company_channels_bot_username ON company_channels(bot_username) WHERE bot_username IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS company_channels_bot_telegram_id ON company_channels(bot_telegram_id) WHERE bot_telegram_id IS NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO company_channels (
  id, tenant_id, type, label, enabled, auth_mode, phone_verification,
  password_setup, languages_json, default_language, source_channel, entry_slug
)
SELECT
  'h5-' || slug, id, 'h5', name || ' H5', active, 'sms', 1,
  0,
  json_object('zh', client_zh_enabled = 1, 'en', client_en_enabled = 1, 'km', client_km_enabled = 1),
  CASE WHEN client_zh_enabled = 1 THEN 'zh' WHEN client_en_enabled = 1 THEN 'en' ELSE 'km' END,
  'H5', slug
FROM team_companies;
--> statement-breakpoint
INSERT OR IGNORE INTO company_channels (
  id, tenant_id, type, label, enabled, auth_mode, phone_verification,
  password_setup, languages_json, default_language, source_channel, entry_slug,
  hosts_json, allowed_origins_json, app_platform, package_id, api_base_url,
  cookie_hosts_json, min_supported_version, latest_version, download_url,
  force_upgrade, maintenance_messages_json
)
SELECT
  'app-' || slug, id, 'app', name || ' App', active, 'sms', 1,
  0,
  json_object('zh', client_zh_enabled = 1, 'en', client_en_enabled = 1, 'km', client_km_enabled = 1),
  CASE WHEN client_zh_enabled = 1 THEN 'zh' WHEN client_en_enabled = 1 THEN 'en' ELSE 'km' END,
  'AP', slug,
  '["testapi.khmerx.org"]', '["https://testpayease.khmerx.org"]', 'android',
  'org.khmerx.payease', 'https://testapi.khmerx.org',
  '["testapi.khmerx.org","testpayease.khmerx.org"]',
  NULL, NULL, 'https://testapi.khmerx.org/app/latest', 0,
  json_object('zh', '系统维护中，请稍后再试', 'en', 'System maintenance. Please try again later.', 'km', 'ប្រព័ន្ធកំពុងថែទាំ សូមព្យាយាមម្ដងទៀត')
FROM team_companies;
--> statement-breakpoint
INSERT OR IGNORE INTO company_channels (
  id, tenant_id, type, label, enabled, auth_mode, phone_verification,
  password_setup, source_channel, entry_slug, telegram_bot_id,
  bot_username, bot_telegram_id, telegram_token_configured
)
SELECT
  'tg-' || replace(replace(c.id, '-', ''), ':', '') || '-' || replace(replace(b.bot_id, '-', ''), ':', ''),
  c.id, 'telegram_miniapp', COALESCE(b.label, b.username, b.bot_id), c.active, 'telegram', 0,
  0, 'TG', c.slug, b.bot_id, NULLIF(b.username, ''), NULLIF(b.telegram_id, ''), 1
FROM telegram_bot_credentials b
JOIN team_companies c ON c.id = b.owner;
--> statement-breakpoint
INSERT INTO team_audit (id, tenant_id, actor, action, detail, created_at)
SELECT
  'company-channels-backfill:' || id, id, 'migration:0063', 'company_channels_backfill',
  '{"source":"team_companies/client_flags and telegram_bot_credentials","secrets":"not copied"}', datetime('now')
FROM team_companies
WHERE NOT EXISTS (
  SELECT 1 FROM team_audit a
  WHERE a.id = 'company-channels-backfill:' || team_companies.id
);
