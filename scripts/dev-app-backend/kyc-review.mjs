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
const secret = (readEnvLocal().KYC_DATA_SECRET || process.env.KYC_DATA_SECRET || (process.env.KHMERX_TEST_MODE === 'true' ? 'local-harness-kyc-secret-change-me-32' : '')).trim();
if (secret.length < 32) { console.error('KYC_DATA_SECRET (>= 32 chars) not found in .env.local'); process.exit(1); }

const enc = new TextEncoder();
const legacyKeyBytes = await crypto.subtle.digest('SHA-256', enc.encode('payease-kyc-v1:' + secret));
const legacyKey = await crypto.subtle.importKey('raw', legacyKeyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
const derivedKey = async (keyId) => {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HKDF' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('payease-kyc-salt:' + keyId), info: enc.encode('payease-kyc-aes-gcm-v2') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
const b64ToBytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
async function unseal(value, context) {
  const b = b64ToBytes(value);
  let key, offset = 0;
  if (b[0] === 0x4b && b[1] === 0x02 && b[2] > 0 && b[2] <= 64) {
    const length = b[2], keyId = new TextDecoder().decode(b.slice(3, 3 + length));
    key = await derivedKey(keyId); offset = 3 + length;
  } else key = legacyKey;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(offset, offset + 12), additionalData: enc.encode(context) }, key, b.slice(offset + 12));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function seal(value, context) {
  const keyId = 'v2', key = await derivedKey(keyId), id = enc.encode(keyId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(context) }, key, enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(3 + id.length + 12 + cipher.length);
  out.set([0x4b, 0x02, id.length]); out.set(id, 3); out.set(iv, 3 + id.length); out.set(cipher, 15 + id.length);
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
