import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
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
const configPath = join(data, 'config.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
const configuredAdmin = config.companies?.find(company => company.id === companyId)?.accounts?.find(account => account.role === 'admin');
const staff = ['admin', 'business', 'kyc', 'checker', 'finance', 'finance_checker', 'lender'].map(role => {
  const email = role === 'admin' ? configuredAdmin?.email || 'gray-admin@example.test' : `local-${role}@example.test`;
  const credentials = hashPassword(`Acceptance-${randomBytes(18).toString('base64url')}`);
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
const scanner = spawn(process.execPath, ['-e', "const http=require('node:http');http.createServer((req,res)=>{if(req.method!=='POST'||req.url!=='/scan'){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({clean:true,status:'clean'}))}).listen(9999,'127.0.0.1')"], { detached: true, stdio: 'ignore' });
scanner.unref();
const port = Number(process.env.LOCAL_ACCEPTANCE_PORT || 4300);
const base = `http://127.0.0.1:${port}`;
const admin = staff.find(entry => entry.role === 'admin');
if (!admin) throw new Error('admin seed missing');
const cookieJar = new Map();
const remember = response => { for (const value of response.headers.getSetCookie?.() || []) { const first = value.split(';', 1)[0]; const at = first.indexOf('='); if (at > 0) cookieJar.set(first.slice(0, at), first.slice(at + 1)); } };
const api = async (path, body) => {
  const headers = new Headers({ Origin: base, 'content-type': 'application/json' });
  if (cookieJar.size) headers.set('Cookie', [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; '));
  const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  remember(response);
  return { response, body: await response.json() };
};
const login = await api('/api/team/auth', { action: 'login', portal: 'business', company: 'khmerx-gray', email: admin.email, password: admin.password });
if (!login.response.ok) throw new Error(`admin login failed while preparing channel: HTTP ${login.response.status} ${JSON.stringify(login.body)}`);
const bot = await api('/api/state', { action: 'bot_save', requestId: `seed-${randomBytes(12).toString('hex')}`, botId: 'bot-1', label: 'Local acceptance channel', username: '', enabled: true, phoneVerification: true, passwordSetup: true });
if (!bot.response.ok) throw new Error(`admin bot_save failed while preparing channel: HTTP ${bot.response.status} ${JSON.stringify(bot.body)}`);
const channelDb = new DatabaseSync(dbPath);
channelDb.prepare(`INSERT OR IGNORE INTO company_channels (id,tenant_id,type,label,enabled,auth_mode,phone_verification,password_setup,languages_json,default_language,source_channel,hosts_json,allowed_origins_json,entry_slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`h5-${companyId}`, companyId, 'h5', 'Local acceptance H5', 1, 'demo', 1, 1, JSON.stringify({ zh: true, en: true, km: true }), 'zh', 'H5', JSON.stringify(['127.0.0.1']), JSON.stringify([base]), 'khmerx-gray');
channelDb.prepare(`INSERT OR IGNORE INTO company_channels (id,tenant_id,type,label,enabled,auth_mode,phone_verification,password_setup,languages_json,default_language,source_channel,app_platform,api_base_url,cookie_hosts_json,entry_slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`app-${companyId}`, companyId, 'app', 'Local acceptance App', 1, 'sms', 1, 1, JSON.stringify({ zh: true, en: true, km: true }), 'zh', 'AP', 'android', base, JSON.stringify(['127.0.0.1']), 'khmerx-gray');
channelDb.close();
const output = join(data, 'local-acceptance-staff.json');
writeFileSync(output, JSON.stringify({ companyId, dbPath, staff }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ event: 'local_acceptance_seeded', companyId, output }));
