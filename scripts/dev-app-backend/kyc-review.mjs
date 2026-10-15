// DEV ONLY: simulates the back-office KYC reviewer on the LOCAL database so the
// app's needs_info / approved / rejected screens can be tested.
//   node scripts/dev-app-backend/kyc-review.mjs needs_info "Photo is blurry"
//   node scripts/dev-app-backend/kyc-review.mjs approved
//   node scripts/dev-app-backend/kyc-review.mjs rejected "Not eligible"
//   node scripts/dev-app-backend/kyc-review.mjs status        (print current status only)
// Acts on the most recently updated KYC case of the public workspace. Uses the
// same AES-GCM sealing as lib/kyc/server.ts with KYC_DATA_SECRET from .env.local.
import { webcrypto as crypto } from 'node:crypto';
import { openDevDb, PUBLIC_COMPANY_ID, readEnvLocal } from './common.mjs';

const [decision = 'status', reason = ''] = process.argv.slice(2);
if (!['needs_info', 'approved', 'rejected', 'submitted', 'status'].includes(decision)) {
  console.error('decision must be needs_info | approved | rejected | submitted | status');
  process.exit(1);
}
const secret = (readEnvLocal().KYC_DATA_SECRET || process.env.KYC_DATA_SECRET || '').trim();
if (secret.length < 32) { console.error('KYC_DATA_SECRET (>= 32 chars) not found in .env.local'); process.exit(1); }

const enc = new TextEncoder();
const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode('payease-kyc-v1:' + secret));
const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
const b64ToBytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
async function unseal(value, context) {
  const b = b64ToBytes(value);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12), additionalData: enc.encode(context) }, key, b.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function seal(value, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(context) }, key, enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(12 + cipher.length);
  out.set(iv); out.set(cipher, 12);
  return Buffer.from(out).toString('base64');
}

const db = openDevDb();
const row = db.prepare('SELECT * FROM kyc_cases WHERE owner=? ORDER BY updated_at DESC LIMIT 1').get(PUBLIC_COMPANY_ID);
if (!row) { console.error('No KYC case yet: open the KYC screen in the app first.'); process.exit(1); }
const data = await unseal(row.payload, 'case:' + row.id);
const filled = Object.values(data.profile?.values || {}).filter(Boolean).length;
const files = Object.keys(data.profile?.files || {}).length;
console.log(`case ${row.id.slice(0, 8)}… status=${row.status} revision=${row.revision} values=${filled} files=${files}`);
if (decision === 'status') process.exit(0);

data.review = { decision, reason: reason || decision, checklist: {}, actor: 'dev-script', at: new Date().toISOString(), revision: row.revision };
const now = new Date().toISOString();
db.prepare('UPDATE kyc_cases SET status=?, payload=?, revision=revision+1, updated_at=? WHERE id=?')
  .run(decision, await seal(data, 'case:' + row.id), now, row.id);
console.log(`case set to ${decision}${reason ? ' with note' : ''}`);
