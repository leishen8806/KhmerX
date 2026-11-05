// Seeds ONE test company that acts as the public customer workspace (docs 54),
// mirroring what deploy/standalone/server.mjs does for companies[0]. Idempotent.
import { openDevDb, PUBLIC_COMPANY_ID } from './common.mjs';
import { migrateDev } from './migrate-dev.mjs';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const demoPassword = (password, salt = randomBytes(32).toString('hex')) =>
  `v2:600000:${salt}:${pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex')}`;

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
db.prepare('INSERT OR IGNORE INTO team_members(id,tenant_id,user_id,email,role,active,version) VALUES (?,?,?,?,?,1,0)')
  .run('local-demo-admin', t, 'b0-runner@example.test', 'b0-runner@example.test', 'admin');
// Keep the local acceptance harness self-contained: these are fictional staff
// accounts used only to exercise the approval and two-person funding chain.
// Production staff are provisioned through the normal dual-control flow.
const demoStaff = [
  ['local-demo-lender', 'local-demo-lender', 'lender@example.test', 'lender'],
  ['local-demo-checker', 'local-demo-checker', 'checker@example.test', 'checker'],
  ['local-demo-finance', 'local-demo-finance', 'finance@example.test', 'finance'],
  ['local-demo-finance-checker', 'local-demo-finance-checker', 'finance-checker@example.test', 'finance_checker'],
];
for (const [id, userId, email, role] of demoStaff) {
  db.prepare('INSERT OR IGNORE INTO team_members(id,tenant_id,user_id,email,role,unit_id,active,version) VALUES (?,?,?,?,?,?,1,0)')
    .run(id, t, userId, email, role, institution);
  db.prepare('INSERT OR IGNORE INTO team_staff_credentials(member_id,password_hash,version) VALUES (?,?,0)')
    .run(id, demoPassword('1234567890', `local-${id}`));
}
const state = {
  loans: [],
  bots: [{ id: 'bot-1', label: 'Test channel', username: '', enabled: true, envKey: 'TELEGRAM_BOT_TOKEN_1', phoneVerification: false, passwordSetup: false }],
  events: [], entries: [], notifications: [], requests: [],
};
db.prepare('INSERT OR IGNORE INTO demo_workspaces(owner,revision,payload) VALUES (?,0,?)').run(t, JSON.stringify(state));
db.exec('COMMIT');
console.log('seeded public workspace', t);
