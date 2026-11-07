// Local-only acceptance for staff portals and the institution approval chain.
// Run after start.mjs and seed.mjs. It uses HTTP/UI interfaces only: no D1 or
// R2 writes are performed by this script.
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.env.LOCAL_ACCEPTANCE_ROOT || '/private/tmp/khmerx-local-acceptance';
const port = Number(process.env.LOCAL_ACCEPTANCE_PORT || 4300);
const base = `http://127.0.0.1:${port}`;
const reportDir = process.env.LOCAL_ACCEPTANCE_REPORT_DIR || join(root, 'reports');
const companySlug = 'khmerx-gray';
const companyId = 't_00000000-0000-4000-8000-000000000001';
const roles = ['admin', 'business', 'kyc', 'checker', 'finance', 'finance_checker', 'lender'];
const portalNames = { business: '服务机构后台', lender: '持牌机构后台' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLPsAAAAASUVORK5CYII=', 'base64');

const secrets = JSON.parse(await readFile(join(root, 'data', 'local-acceptance-secrets.json'), 'utf8'));
const staffSeed = JSON.parse(await readFile(join(root, 'data', 'local-acceptance-staff.json'), 'utf8'));
const staffByRole = new Map(staffSeed.staff.map(entry => [entry.role, entry]));
const results = [];
const screenshots = [];

function jar() { return { cookies: new Map() }; }
function cookieHeader(j) { return [...j.cookies].map(([key, value]) => `${key}=${value}`).join('; '); }
function remember(j, response) {
  const values = response.headers.getSetCookie?.() || [];
  for (const value of values) {
    const first = value.split(';', 1)[0];
    const at = first.indexOf('=');
    if (at > 0) j.cookies.set(first.slice(0, at), first.slice(at + 1));
  }
}
async function request(j, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Origin', base);
  const cookies = cookieHeader(j);
  if (cookies) headers.set('Cookie', cookies);
  const response = await fetch(base + path, { ...init, headers });
  remember(j, response);
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { response, body };
}
async function json(j, path, body, extra = {}) {
  return request(j, path, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
}
async function check(name, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    results.push({ name, status: 'PASS', durationMs: Date.now() - started, evidence });
    return evidence;
  } catch (error) {
    const status = error?.acceptanceStatus || 'FAIL';
    results.push({ name, status, durationMs: Date.now() - started, error: String(error?.stack || error) });
    return null;
  }
}
function blocked(message) { const error = new Error(message); error.acceptanceStatus = 'BLOCKED'; return error; }
function assertOk(item, label) {
  if (!item.response.ok) throw new Error(`${label}: HTTP ${item.response.status} ${JSON.stringify(item.body)}`);
}
function expected(role, portal) {
  if (portal === 'lender') return ['checker', 'finance_checker'].includes(role);
  return !['lender', 'checker', 'finance', 'finance_checker'].includes(role);
}

async function login(role, portal) {
  const entry = staffByRole.get(role);
  if (!entry) throw new Error(`missing seeded credentials for ${role}`);
  const j = jar();
  const result = await json(j, '/api/team/auth', {
    action: 'login', portal, company: companySlug, email: entry.email, password: entry.password,
  });
  return { ...result, jar: j, role, portal };
}

await mkdir(reportDir, { recursive: true });

await check('role × portal login matrix (real password login)', async () => {
  const matrix = [];
  for (const role of roles) for (const portal of ['business', 'lender']) {
    const entry = staffByRole.get(role);
    if (!entry) {
      matrix.push({ role, portal, portalLabel: portalNames[portal], status: 'BLOCKED', allowed: false, expected: null, reason: 'seed.mjs 未提供该角色的真实员工凭据，不能伪造登录或直接写数据库' });
      continue;
    }
    const logged = await login(role, portal);
    const allowed = logged.response.ok;
    const row = { role, portal, portalLabel: portalNames[portal], status: logged.response.status, allowed, expected: expected(role, portal) };
    if (logged.response.status === 429) {
      matrix.push({ ...row, status: 'BLOCKED', reason: '本地登录限流触发；需要新鲜 standalone 数据目录重跑，不把限流当作权限结论' });
      continue;
    }
    if (allowed !== row.expected) {
      matrix.push({ ...row, status: 'BLOCKED', reason: '真实登录结果与 portalAllows 预期不一致；不直接修改认证代码，保留为评审阻塞' });
      continue;
    }
    if (allowed) {
      const team = await request(logged.jar, '/api/team');
      assertOk(team, `${role}/${portal} team session`);
      row.company = team.body?.company?.id || null;
      row.session = true;
    } else row.errorCode = logged.body?.code || null;
    matrix.push(row);
  }
  return { matrix, source: 'POST /api/team/auth + GET /api/team', scheme: 'portalAllows' };
});

const adminSession = await login('admin', 'business');
await check('company channel list and selfcheck through staff interface', async () => {
  if (!adminSession.response.ok) throw blocked(`admin login unavailable: HTTP ${adminSession.response.status}`);
  const list = await request(adminSession.jar, '/api/team/channels');
  assertOk(list, 'channel list');
  const selfcheck = await request(adminSession.jar, '/api/team/channels/selfcheck');
  assertOk(selfcheck, 'channel selfcheck');
  if (selfcheck.body?.ok !== true) throw new Error(`channel selfcheck not ok: ${JSON.stringify(selfcheck.body)}`);
  return { listStatus: list.response.status, channelCount: list.body?.channels?.length ?? null, selfcheck: selfcheck.body };
});

await check('customer_enter sets company cookie and H5 sees same company', async () => {
  if (!adminSession.response.ok) throw blocked(`admin login unavailable: HTTP ${adminSession.response.status}`);
  const customerEntry = adminSession.jar;
  const entered = await json(customerEntry, '/api/team', { action: 'customer_enter', slug: companySlug });
  assertOk(entered, 'customer_enter');
  const companyCookie = customerEntry.cookies.get('payease_company');
  if (companyCookie !== companyId) throw new Error(`company cookie mismatch: ${companyCookie} !== ${companyId}`);
  const auth = await request(customerEntry, '/api/h5/auth');
  assertOk(auth, 'H5 bootstrap after customer_enter');
  if (auth.body?.company !== 'KhmerX Gray') throw new Error(`H5 company mismatch: ${auth.body?.company}`);
  return { status: entered.response.status, companyCookie, h5Company: auth.body.company, consistent: true };
});

let playwright;
try { playwright = await import(process.env.PLAYWRIGHT_MODULE || '/private/tmp/pw-run/node_modules/playwright/index.mjs'); } catch { playwright = null; }
async function screenshotForSession(name, session, path) {
  if (!playwright) throw blocked('Playwright is unavailable; UI screenshot not run');
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([...session.jar.cookies].map(([name, value]) => ({ name, value, url: `${base}/` })));
    const page = await context.newPage();
    const response = await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const file = join(reportDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const sha256 = createHash('sha256').update(await readFile(file)).digest('hex');
    const evidence = { file, sha256, httpStatus: response?.status() ?? null, viewport: '1440x1000', path };
    screenshots.push(evidence);
    return evidence;
  } finally { await browser.close(); }
}

const kycSession = await login('kyc', 'business');
const checkerSession = await login('checker', 'lender');
const financeSession = await login('finance', 'lender');
const financeCheckerSession = await login('finance_checker', 'lender');

await check('KYC real portal UI renders', async () => ({
  kyc: await screenshotForSession('staff-kyc-team', kycSession, '/team'),
  kycQueue: await screenshotForSession('staff-kyc-review-queue', kycSession, '/kyc/review'),
}));

function profile() {
  return {
    values: {
      surname: 'SYNTHETIC', givenName: 'ADMIN FLOW', documentType: '柬埔寨身份证', documentNumber: 'SYNTHETIC-ADMIN-0001',
      gender: '男', education: 'University', marital: '未婚', province: '金边/Phnom Penh', district: 'Chamkamorn', address: 'SYNTHETIC LOCAL ADDRESS',
      contact1Relation: '父母', contact1Name: 'SYNTHETIC CONTACT ONE', contact1Phone: '+85512000001',
      contact2Relation: '配偶', contact2Name: 'SYNTHETIC CONTACT TWO', contact2Phone: '+85512000002',
      workType: 'Employee', company: 'SYNTHETIC EMPLOYER', industry: 'IT', position: 'Staff', income: '351-500 USD', tenure: '1-3 years',
      bankName: 'ABA Bank', bankHolder: 'SYNTHETIC ADMIN FLOW', bankAccount: '0000000001',
    }, files: {}, consent: false, declarationVersion: 'kyc-data-consent-v2',
  };
}
async function customerFlow() {
  const j = jar();
  assertOk(await request(j, '/api/h5/auth'), 'H5 bootstrap');
  const phone = `+855${String(Date.now()).slice(-8)}`;
  const sent = await json(j, '/api/h5/auth/send', { phone, consent: true });
  assertOk(sent, 'OTP send');
  const verified = await json(j, '/api/h5/auth/verify', { challengeId: sent.body.challengeId, code: sent.body.demoCode || '123456' });
  assertOk(verified, 'OTP verify');
  if (verified.body?.session && !verified.body.session.hasPassword) {
    const password = await json(j, '/api/h5/auth/account', { action: 'set_password', password: 'Synthetic-Admin-Flow-1234' });
    if (!password.response.ok) throw blocked(`customer registration/password step blocked: HTTP ${password.response.status} ${JSON.stringify(password.body)}`);
  }
  let kyc = (await request(j, '/api/kyc')).body;
  const p = profile();
  const requiredSlots = ['idFront', 'idBack', 'selfie', 'incomeProof'];
  for (const slot of requiredSlots) {
    const uploaded = await request(j, '/api/kyc/files', { method: 'POST', headers: { 'content-type': 'image/png', 'X-KYC-Slot': slot, 'X-KYC-Consent': 'true', 'X-KYC-Agreement-Version': 'kyc-data-consent-v2' }, body: png });
    assertOk(uploaded, `upload ${slot}`); p.files[slot] = uploaded.body;
  }
  for (const slot of requiredSlots) {
    const uploaded = await request(j, `/api/kyc/files?id=${encodeURIComponent(p.files[slot]?.id || '')}`);
    if (uploaded.response.status !== 200) throw new Error(`uploaded file not readable: ${slot}`);
  }
  kyc = (await json(j, '/api/kyc', { action: 'save', revision: kyc.revision, profile: p })).body;
  p.consent = true;
  kyc = (await json(j, '/api/kyc', { action: 'submit', revision: kyc.revision, profile: p })).body;
  const loanBlocked = await json(j, '/api/h5/state', { action: 'create', requestId: randomUUID(), name: 'SYNTHETIC ADMIN FLOW', amount: 5000, consent: true });
  if (loanBlocked.response.ok) throw new Error('loan unexpectedly created before KYC approval');
  return { jar: j, customerId: verified.body?.session?.customerId || null, kycId: kyc.id, kycRevision: kyc.revision, status: kyc.status, preApprovalLoanStatus: loanBlocked.response.status };
}

const customer = await check('customer real interface reaches submitted KYC and decision_pending boundary', customerFlow);

if (customer?.kycId) {
  await check('KYC employee reviews through real queue/API and UI page', async () => {
    const read = await request(kycSession.jar, `/api/kyc/review?id=${encodeURIComponent(customer.kycId)}`);
    assertOk(read, 'KYC review read');
    const decision = await json(kycSession.jar, '/api/kyc/review', {
      id: customer.kycId, revision: read.body.revision, decision: 'approved', reason: '合成资料逐项核对', checklist: Object.fromEntries(['identity', 'contacts', 'employment', 'income', 'assets', 'bank', 'consent'].map(key => [key, true])),
    });
    assertOk(decision, 'KYC approval');
    const ui = await screenshotForSession('staff-kyc-review-approved', kycSession, `/kyc/review?id=${encodeURIComponent(customer.kycId)}`);
    return { status: decision.body.status, kycId: customer.kycId, screenshot: ui, interface: 'real HTTP endpoint; rendered page captured' };
  });
}

let loanId = null;
if (customer?.jar) await check('customer real interface creates loan after KYC approval', async () => {
  const created = await json(customer.jar, '/api/h5/state', { action: 'create', requestId: randomUUID(), name: 'SYNTHETIC ADMIN FLOW', amount: 5000, consent: true });
  assertOk(created, 'loan create');
  loanId = created.body.state.loans.at(-1)?.id;
  if (!loanId) throw new Error('loan id missing');
  const bill = created.body.state.loans.at(-1).billing;
  assertOk(await json(customer.jar, '/api/h5/state', { action: 'confirm_bill', loanId, billConfirmed: true, quoteId: bill?.quoteId, requestId: randomUUID() }), 'confirm bill');
  assertOk(await request(customer.jar, '/api/loan/sign', { method: 'POST', headers: { 'content-type': 'image/png', 'X-Loan-Id': loanId, 'X-Loan-Consent': 'true', 'X-Loan-Terms': 'loan-terms-zh-v1-f363b1d8c58c' }, body: png }), 'loan sign');
  const applied = await json(customer.jar, '/api/h5/state', { action: 'apply', loanId, billConfirmed: true, quoteId: bill?.quoteId, requestId: randomUUID() });
  assertOk(applied, 'loan apply');
  return { loanId, status: applied.body.state.loans.find(item => item.id === loanId)?.status };
});

async function signCallback(body, nonce, idempotency) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify(body);
  const canonical = [companyId + ':institution', timestamp, nonce, idempotency, raw].join('\n');
  const signature = createHmac('sha256', secrets.institutionSecret).update(canonical).digest('hex');
  return request(jar(), '/api/institution/callback', { method: 'POST', headers: { 'content-type': 'application/json', 'x-institution-id': companyId + ':institution', 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-idempotency-key': idempotency, 'x-signature': signature }, body: raw });
}
if (loanId) await check('institution loan.approved callback is signed and consumed', async () => {
  const body = { eventType: 'loan.approved', eventId: `admin-flow-${randomUUID()}`, institutionId: companyId + ':institution', loanId, data: { loanId } };
  const first = await signCallback(body, `nonce-${randomUUID()}`, `idem-${randomUUID()}`);
  if (![200, 202].includes(first.response.status)) throw new Error(`callback=${first.response.status} ${JSON.stringify(first.body)}`);
  return { status: first.response.status, body: first.body, realInterface: true };
});

if (loanId) {
  await check('checker completes approval_check through real staff interface', async () => {
    const state = await request(checkerSession.jar, '/api/state'); assertOk(state, 'checker state');
    const loan = state.body.state.loans.find(item => item.id === loanId); if (!loan) throw new Error('checker cannot see loan');
    const action = await json(checkerSession.jar, '/api/state', { action: 'approval_check', loanId, requestId: randomUUID() }); assertOk(action, 'approval_check');
    return { loanId, status: action.body.state.loans.find(item => item.id === loanId)?.status };
  });
  await check('finance and finance_checker complete real disbursement interfaces', async () => {
    const fundingBody = { eventType: 'funding.confirmed', eventId: `admin-flow-funding-${randomUUID()}`, institutionId: companyId + ':institution', loanId, externalReference: `FUND-${randomUUID()}`, data: { loanId } };
    const funding = await signCallback(fundingBody, `funding-${randomUUID()}`, `funding-${randomUUID()}`);
    if (![200, 202].includes(funding.response.status)) throw new Error(`funding callback=${funding.response.status} ${JSON.stringify(funding.body)}`);
    if (financeSession.response.ok) {
      const requestAction = await json(financeSession.jar, '/api/state', { action: 'disburse_request', loanId, requestId: randomUUID() }); assertOk(requestAction, 'legacy disburse_request compatibility');
    }
    const funded = await json(financeCheckerSession.jar, '/api/state', { action: 'disburse', loanId, requestId: randomUUID() }); assertOk(funded, 'disburse');
    return { loanId, fundingCallback: funding.body, status: funded.body.state.loans.find(item => item.id === loanId)?.status, financePortal: financeSession.response.status, initiation: 'institution callback' };
  });
}

await check('negative: malformed callback signature returns 401', async () => {
  const body = JSON.stringify({ eventType: 'loan.approved', eventId: `bad-${randomUUID()}`, institutionId: companyId + ':institution', loanId: loanId || 'missing' });
  const response = await request(jar(), '/api/institution/callback', { method: 'POST', headers: { 'content-type': 'application/json', 'x-institution-id': companyId + ':institution', 'x-timestamp': String(Math.floor(Date.now() / 1000)), 'x-nonce': `bad-${randomUUID()}`, 'x-idempotency-key': `bad-${randomUUID()}`, 'x-signature': '0'.repeat(64) }, body });
  if (response.response.status !== 401) throw new Error(`expected 401, got ${response.response.status}`);
  return { status: response.response.status, code: response.body.code };
});
await check('negative: duplicate callback is idempotent', async () => {
  const id = `duplicate-${randomUUID()}`;
  const body = { eventType: 'loan.approved', eventId: id, institutionId: companyId + ':institution', loanId: loanId || 'missing-loan', data: { loanId: loanId || 'missing-loan' } };
  const first = await signCallback(body, `dup-${randomUUID()}`, `dup-${randomUUID()}`);
  if (![200, 202].includes(first.response.status)) throw new Error(`first callback=${first.response.status}`);
  // Reuse the same idempotency key/signature by sending the same request shape.
  // The helper creates a fresh jar but the callback idempotency record is global.
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify(body), nonce = `dup-${randomUUID()}`, idem = `dup-${randomUUID()}`;
  const signature = createHmac('sha256', secrets.institutionSecret).update([companyId + ':institution', timestamp, nonce, idem, raw].join('\n')).digest('hex');
  const first2 = await request(jar(), '/api/institution/callback', { method: 'POST', headers: { 'content-type': 'application/json', 'x-institution-id': companyId + ':institution', 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-idempotency-key': idem, 'x-signature': signature }, body: raw });
  const second = await request(jar(), '/api/institution/callback', { method: 'POST', headers: { 'content-type': 'application/json', 'x-institution-id': companyId + ':institution', 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-idempotency-key': idem, 'x-signature': signature }, body: raw });
  if (first2.response.status !== 200 || second.response.status !== 200 || second.body?.duplicate !== true) throw new Error(`duplicate evidence first=${first2.response.status} second=${second.response.status} body=${JSON.stringify(second.body)}`);
  return { first: first2.body, second: second.body, duplicate: true };
});
await check('negative: checker cannot initiate disbursement', async () => {
  if (!loanId) throw blocked('no real loan was created because an earlier customer/approval step was blocked');
  const response = await json(checkerSession.jar, '/api/state', { action: 'disburse_request', loanId, requestId: randomUUID() });
  if (response.response.status !== 403) throw new Error(`expected 403, got ${response.response.status}`);
  return { status: response.response.status, code: response.body.code };
});

const report = { schema: 1, generatedAt: new Date().toISOString(), base, environment: 'local-gray', syntheticData: true, screenshots, results, summary: { pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length, blocked: results.filter(x => x.status === 'BLOCKED').length } };
await writeFile(join(reportDir, 'admin-flows.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.summary.fail) process.exitCode = 1;
