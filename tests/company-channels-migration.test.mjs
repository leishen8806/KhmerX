import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {splitSql} from '../deploy/standalone/sql-split.mjs';

test('0064 creates channel records without copying secrets and is idempotent', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE team_companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, active INTEGER NOT NULL,
      client_zh_enabled INTEGER NOT NULL, client_en_enabled INTEGER NOT NULL, client_km_enabled INTEGER NOT NULL
    );
    CREATE TABLE telegram_bot_credentials (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, bot_id TEXT NOT NULL, telegram_id TEXT NOT NULL,
      label TEXT NOT NULL, username TEXT NOT NULL, token_encrypted TEXT NOT NULL,
      version INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE team_audit (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor TEXT NOT NULL,
      action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE demo_workspaces (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL);
    INSERT INTO team_companies VALUES ('t_a','Alpha','alpha',1,1,0,1);
    INSERT INTO telegram_bot_credentials VALUES ('cred-a','t_a','bot-1','123','Alpha Bot','alpha_bot','ciphertext',1,'now');
    INSERT INTO demo_workspaces VALUES ('t_a',0,'{"activeBotId":"bot-1","bots":[{"id":"bot-1","enabled":true,"passwordSetup":false}]}');
  `);
  const migration = readFileSync('drizzle/0064_company_channels.sql', 'utf8');
  for (const statement of splitSql(migration)) db.exec(statement);
  for (const statement of splitSql(migration)) db.exec(statement);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM company_channels').get().n, 3);
  const h5 = db.prepare("SELECT * FROM company_channels WHERE type='h5'").get();
  assert.equal(h5.source_channel, 'H5');
  assert.equal(h5.phone_verification, 1);
  assert.equal(h5.password_setup, 0);
  assert.deepEqual(JSON.parse(h5.hosts_json), []);
  assert.deepEqual(JSON.parse(h5.allowed_origins_json), []);
  assert.deepEqual(JSON.parse(h5.languages_json), {zh: 1, en: 0, km: 1});
  const tg = db.prepare("SELECT * FROM company_channels WHERE type='telegram_miniapp'").get();
  assert.equal(tg.bot_username, 'alpha_bot');
  assert.equal(tg.token_encrypted, undefined);
  assert.equal(tg.password_setup, 0);
  const app = db.prepare("SELECT * FROM company_channels WHERE type='app'").get();
  assert.equal(app.app_platform, 'android');
  assert.equal(app.api_base_url, null);
  assert.deepEqual(JSON.parse(app.hosts_json), []);
  assert.deepEqual(JSON.parse(app.allowed_origins_json), []);
  assert.deepEqual(JSON.parse(app.cookie_hosts_json), []);
  assert.equal(app.password_setup, 0);
  assert.equal(app.force_upgrade, 0);
  assert.deepEqual(JSON.parse(app.maintenance_messages_json), {
    zh: '系统维护中，请稍后再试',
    en: 'System maintenance. Please try again later.',
    km: 'ប្រព័ន្ធកំពុងថែទាំ សូមព្យាយាមម្ដងទៀត'
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM team_audit').get().n, 1);
  const columns = db.prepare('PRAGMA table_info(company_channels)').all().map(row => row.name);
  assert(!columns.includes('telegram_token_configured'));
  assert(!columns.includes('telegram_token_last4'));
  db.close();
});
