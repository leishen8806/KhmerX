import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.LOCAL_ACCEPTANCE_ROOT || '/private/tmp/khmerx-local-acceptance';
const data = join(root, 'data');
const companyId = 't_00000000-0000-4000-8000-000000000001';
const findDb = dir => {
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) { const found = findDb(p); if (found) return found; }
    else if (name.name.endsWith('.sqlite')) {
      const db = new DatabaseSync(p);
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='team_companies'").get();
      db.close(); if (table) return p;
    }
  }
  return null;
};
const dbPath = findDb(join(data, 'd1'));
if (!dbPath) throw new Error('standalone D1 not found; start.mjs must be running first');
const db = new DatabaseSync(dbPath);
const hashPassword = password => {
  const salt = randomBytes(32).toString('hex');
  return { password, hash: `v2:600000:${salt}:${pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex')}` };
};
const staff = ['admin', 'kyc', 'checker', 'finance', 'finance_checker'].map(role => {
  const email = `local-${role}@example.test`, credentials = hashPassword(`Acceptance-${randomBytes(18).toString('base64url')}`);
  return { role, email, ...credentials };
});
const department = companyId + ':ops', institution = companyId + ':institution', postloan = companyId + ':postloan';
db.exec('BEGIN');
db.prepare('INSERT OR IGNORE INTO team_companies(id,name,slug,active,default_department,auto_assign) VALUES (?,?,?,1,?,1)').run(companyId, 'KhmerX Gray', 'khmerx-gray', department);
for (const [id, name, kind] of [[department, 'Operations', 'department'], [institution, 'Acceptance Institution', 'institution'], [postloan, 'Post-loan', 'postloan']]) db.prepare('INSERT OR IGNORE INTO team_units(id,tenant_id,name,kind) VALUES (?,?,?,?)').run(id, companyId, name, kind);
db.prepare('INSERT OR IGNORE INTO team_service_settings(tenant_id,auto_assign,funding_id,repayment_id,collection_id) VALUES (?,1,?,?,?)').run(companyId, institution, institution, postloan);
for (const entry of staff) {
  const id = `${companyId}:${entry.role}`;
  const unit = ['kyc', 'admin'].includes(entry.role) ? department : institution;
  db.prepare('INSERT OR IGNORE INTO team_members(id,tenant_id,user_id,email,role,unit_id,active,version) VALUES (?,?,?,?,?,?,1,0)').run(id, companyId, `local:${entry.role}`, entry.email, entry.role, entry.role === 'admin' ? null : unit);
  db.prepare('INSERT OR REPLACE INTO team_staff_credentials(member_id,password_hash,version) VALUES (?,?,0)').run(id, entry.hash);
}
db.prepare('INSERT OR IGNORE INTO demo_workspaces(owner,revision,payload) VALUES (?,0,?)').run(companyId, JSON.stringify({ loans: [], bots: [{ id: 'bot-1', label: 'Local Telegram', enabled: true, envKey: 'TELEGRAM_BOT_TOKEN_1', phoneVerification: false, passwordSetup: false }], events: [], entries: [], notifications: [], requests: [] }));
db.exec('COMMIT');
db.close();
const output = join(data, 'local-acceptance-staff.json');
writeFileSync(output, JSON.stringify({ companyId, dbPath, staff }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ event: 'local_acceptance_seeded', companyId, output }));
