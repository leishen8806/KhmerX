// Seeds ONE test company that acts as the public customer workspace (docs 54),
// mirroring what deploy/standalone/server.mjs does for companies[0]. Idempotent.
import { openDevDb, PUBLIC_COMPANY_ID } from './common.mjs';
import { migrateDev } from './migrate-dev.mjs';

const t = PUBLIC_COMPANY_ID;
const db = openDevDb();
console.log('dev migrations applied:', migrateDev(db));
// The harness is disposable and may be started repeatedly during local
// acceptance. Clear only authentication throttling state so a prior failed
// run cannot make the next run start with a 429. Business/KYC records remain
// intact for replay and audit checks.
db.exec('DELETE FROM h5_browser_tokens; DELETE FROM h5_limits;');
const dept = t + ':ops', institution = t + ':institution', post = t + ':postloan';
db.exec('BEGIN');
db.prepare('INSERT OR IGNORE INTO team_companies(id,name,slug,active,default_department,auto_assign) VALUES (?,?,?,1,?,1)')
  .run(t, 'KhmerX Test Workspace', 'khmerx-test', dept);
for (const [id, name, kind] of [[dept, 'Ops', 'department'], [institution, 'Test institution', 'institution'], [post, 'Post-loan', 'postloan']]) {
  db.prepare('INSERT OR IGNORE INTO team_units(id,tenant_id,name,kind) VALUES (?,?,?,?)').run(id, t, name, kind);
}
db.prepare('INSERT OR IGNORE INTO team_service_settings(tenant_id,auto_assign,funding_id,repayment_id,collection_id) VALUES (?,1,?,?,?)')
  .run(t, institution, institution, post);
const state = {
  loans: [],
  bots: [{ id: 'bot-1', label: 'Test channel', username: '', enabled: true, envKey: 'TELEGRAM_BOT_TOKEN_1', phoneVerification: false, passwordSetup: false }],
  events: [], entries: [], notifications: [], requests: [],
};
db.prepare('INSERT OR IGNORE INTO demo_workspaces(owner,revision,payload) VALUES (?,0,?)').run(t, JSON.stringify(state));
db.exec('COMMIT');
console.log('seeded public workspace', t);
