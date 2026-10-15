// DEV ONLY smoke test of the KYC contract (docs 76) against the LOCAL backend.
// It talks to the same gateway stand-in the emulator uses (default
// http://127.0.0.1:80, presented as host 10.0.2.2) with exactly the request
// shapes the Flutter app sends, then submits a complete case.
//   node scripts/dev-app-backend/kyc-smoke.mjs [+12025550130]
// Creates a throw-away test customer (fictional number, demo code 123456).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, PROXY_PORT } from './common.mjs';

const phone = process.argv[2] || '+12025550130';
const base = `http://127.0.0.1:${PROXY_PORT}`;
const HOST = '10.0.2.2';
const jar = new Map();
async function call(method, path, { json, bytes, headers = {} } = {}) {
  const h = {
    host: HOST, origin: `http://${HOST}`, accept: 'application/json', ...headers,
    cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
  };
  let body;
  if (json !== undefined) { h['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (bytes) { h['content-type'] = 'application/octet-stream'; body = bytes; }
  const res = await fetch(base + path, { method, headers: h, body });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const must = (r, label, ok = [200]) => {
  if (!ok.includes(r.status)) { console.error(`✗ ${label}: HTTP ${r.status}`, JSON.stringify(r.data).slice(0, 300)); process.exit(1); }
  console.log(`✓ ${label}`);
  return r.data;
};

await call('GET', '/api/h5/auth');
const sent = must(await call('POST', '/api/h5/auth/send', { json: { phone, consent: true } }), 'send code');
must(await call('POST', '/api/h5/auth/verify', { json: { challengeId: sent.challengeId, code: sent.demoCode || '123456' } }), 'verify code');

let kyc = must(await call('GET', '/api/kyc'), 'GET /api/kyc');
console.log('  status =', kyc.status, ' revision =', kyc.revision, ' ruleVersion =', kyc.ruleVersion);

const options = JSON.parse(readFileSync(join(ROOT, 'lib/kyc/options.json'), 'utf8'));
const region = options.regions[0];
const first = (k) => options.options[k][0].value;
const T = {
  male: '男', single: '未婚', parent: '父母', friend: '朋友',
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const files = {};
for (const slot of ['idFront', 'idBack', 'selfie', 'incomeProof']) {
  const ref = must(await call('POST', '/api/kyc/files', { bytes: png, headers: { 'x-kyc-slot': slot } }), `upload ${slot}`);
  files[slot] = { id: ref.id };
}
const values = {
  surname: 'SMOKE', givenName: 'TEST', documentType: '柬埔寨身份证', documentNumber: 'SMOKE-12025550131', gender: T.male, education: first('education'), marital: T.single,
  province: region.value, district: region.districts[0].value, address: 'Test street 1',
  contact1Relation: T.parent, contact1Name: 'ONE', contact1Phone: '+85512345671',
  contact2Relation: T.friend, contact2Name: 'TWO', contact2Phone: '+85512345672',
  workType: first('workType'), company: 'Test shop', industry: first('industry'), position: first('position'),
  income: first('income'), tenure: first('tenure'),
  bankName: 'ABA Bank', bankAccount: '000111222', bankHolder: 'SMOKE TEST',
};
const profile = (consent) => ({ values, files, consent, declarationVersion: 'kyc-data-consent-v2' });

kyc = must(await call('POST', '/api/kyc', { json: { action: 'save', revision: kyc.revision, profile: profile(true) } }), 'save draft');
console.log('  status =', kyc.status, ' revision =', kyc.revision, ' missing =', JSON.stringify(kyc.missing));
// Stale revision must be refused (the app reloads on 409).
const stale = await call('POST', '/api/kyc', { json: { action: 'save', revision: kyc.revision - 1, profile: profile(true) } });
console.log(stale.status === 409 ? '✓ stale revision refused (409)' : `✗ expected 409, got ${stale.status}`);
kyc = must(await call('POST', '/api/kyc', { json: { action: 'submit', revision: kyc.revision, profile: profile(true) } }), 'submit');
console.log('  status =', kyc.status, ' (expected submitted)');
const locked = await call('POST', '/api/kyc', { json: { action: 'save', revision: kyc.revision, profile: profile(true) } });
console.log(locked.status === 409 ? '✓ locked after submit (409)' : `✗ expected 409 after submit, got ${locked.status}`);
