import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import encoding from 'k6/encoding';

const base = String(__ENV.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const parsedMatch = base.match(/^([a-z][a-z0-9+.-]*):\/\/([^/]+)/i);
if (!parsedMatch) throw new Error('BASE_URL 必须包含 http:// 或 https://');
const parsed = { protocol: `${parsedMatch[1].toLowerCase()}:`, hostname: parsedMatch[2].replace(/^.*@/, '').replace(/:\d+$/, '').toLowerCase() };
const blocked = new Set(['payease.khmerx.org', 'admin.khmerx.org', 'api.khmerx.org']);
if (blocked.has(parsed.hostname) || (parsed.protocol === 'https:' && parsed.hostname.endsWith('khmerx.org'))) {
  throw new Error('B0 仅允许本地或预发环境，已拒绝生产目标主机');
}

const requestLatency = new Trend('b0_request_latency', true);
const requestErrors = new Rate('b0_request_errors');
const statusCounts = new Counter('b0_http_status_total');
const codeCounts = new Counter('b0_error_code_total');
const uploads = new Counter('b0_upload_total');
const uploadFailures = new Counter('b0_upload_failure_total');
const statusMetrics = Object.fromEntries([200, 400, 401, 403, 409, 429, 500, 503].map(status => [status, new Counter(`b0_status_${status}`)]));
const codeMetrics = Object.fromEntries(['AUTH_REQUIRED', 'BROWSER_TOKEN_RATE_LIMITED', 'CROSS_SITE_REQUEST', 'INVALID_REQUEST', 'STATE_MUTATION_FAILED', 'KYC_SCAN_REQUIRED'].map(code => [code, new Counter(`b0_code_${code}`)]));
let activeJar;

const stages = __ENV.STAGES === 'true';
const once = __ENV.ONCE === 'true';
const vus = Number(__ENV.VUS || 50);
const duration = String(__ENV.DURATION || '3m');
export const options = once ? {
  scenarios: { main: { executor: 'per-vu-iterations', vus, iterations: 1, maxDuration: '5m' } },
  thresholds: { b0_request_errors: ['rate<0.05'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
} : stages ? {
  scenarios: { main: { executor: 'ramping-vus', startVUs: 0, stages: [
    { target: 100, duration: '3m' }, { target: 100, duration: '3m' },
    { target: 300, duration: '3m' }, { target: 300, duration: '3m' },
    { target: 600, duration: '3m' }, { target: 600, duration: '3m' },
  ], gracefulRampDown: '30s' } },
  thresholds: { b0_request_errors: ['rate<0.05'], b0_upload_failure_total: ['count<1'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
} : {
  scenarios: { main: { executor: 'constant-vus', vus, duration, gracefulStop: '30s' } },
  thresholds: { b0_request_errors: ['rate<0.05'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const common = {
  headers: {
    Origin: base,
    Accept: 'application/json',
    'Cache-Control': 'no-store',
    ...( __ENV.K6_USER_ID ? { 'oai-authenticated-user-id': String(__ENV.K6_USER_ID) } : {}),
    ...( __ENV.K6_USER_EMAIL ? { 'oai-authenticated-user-email': String(__ENV.K6_USER_EMAIL) } : {}),
    ...( __ENV.K6_IDENTITY_PROOF ? { 'x-payease-identity-proof': String(__ENV.K6_IDENTITY_PROOF) } : {}),
  },
  tags: { flow: 'b0-main' },
};
const jpeg = encoding.b64decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AYf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AYf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z', 'std');

function record(res, name) {
  requestLatency.add(res.timings.duration, { endpoint: name });
  statusCounts.add(1, { endpoint: name, status: String(res.status) });
  if (statusMetrics[res.status]) statusMetrics[res.status].add(1);
  let body = {};
  try { body = res.json() || {}; } catch (_) { /* non-JSON failures are recorded below */ }
  if (res.status >= 400) {
    requestErrors.add(true, { endpoint: name });
    if (body.code) {
      codeCounts.add(1, { endpoint: name, code: String(body.code) });
      if (codeMetrics[body.code]) codeMetrics[body.code].add(1);
    }
  } else requestErrors.add(false, { endpoint: name });
  return body;
}

function request(method, path, body, name, extra = {}) {
  const params = { ...common, ...extra, jar: activeJar, headers: { ...common.headers, ...(extra.headers || {}) } };
  const binary = body instanceof Uint8Array || body instanceof ArrayBuffer;
  if (body !== undefined && !binary) { params.headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const response = http.request(method, `${base}${path}`, body, params);
  return { response, body: record(response, name) };
}

function syntheticProfile(files) {
  return { values: {
    surname: `TEST${__VU}`, givenName: `USER${__VU}`,
    documentType: '柬埔寨身份证', documentNumber: `SYNTH-B0-${__VU}-${__ITER}`,
    gender: '男', education: 'High School', marital: '未婚',
    province: '金边/Phnom Penh', district: 'Chamkamorn', address: 'Synthetic B0 address',
    contact1Relation: '父母', contact1Name: 'SYNTH CONTACT ONE', contact1Phone: '+12025550001',
    contact2Relation: '配偶', contact2Name: 'SYNTH CONTACT TWO', contact2Phone: '+12025550002',
    workType: 'Employee', company: 'Synthetic Test Co', industry: 'IT', position: 'Staff',
    income: '351-500 USD', tenure: '1-3 years',
    bankName: 'ABA Bank', bankHolder: `TEST${__VU} USER${__VU}`, bankAccount: `000000${__VU}${__ITER}`,
  }, files, consent: true, declarationVersion: 'kyc-data-consent-v2' };
}

function must(ok, message) { if (!ok) fail(message); }

export default function () {
  if (!activeJar) activeJar = http.cookieJar();
  if (__ENV.K6_COMPANY) activeJar.set(base, 'payease_company', String(__ENV.K6_COMPANY));
  const preflight = request('GET', '/api/h5/auth', undefined, 'auth_preflight');
  must(check(preflight.response, { 'auth preflight': r => r.status === 200 }), `认证预检失败: ${preflight.response.status}`);

  // Demo auth intentionally accepts only the fictional +12025550100..199 range.
  const phone = `+1202555${String(100 + ((__VU + __ITER) % 100)).padStart(4, '0')}`;
  const sent = request('POST', '/api/h5/auth/send', { phone, consent: true }, 'auth_send');
  must(check(sent.response, { 'auth send': r => r.status === 200 }), `验证码发送失败: ${sent.response.status}`);
  const code = sent.body.demoCode || __ENV.K6_DEMO_CODE || '123456';
  const verified = request('POST', '/api/h5/auth/verify', { challengeId: sent.body.challengeId, code }, 'auth_verify');
  must(check(verified.response, { 'auth verify': r => r.status === 200 }), `验证码校验失败: ${verified.response.status}`);

  const kyc = request('GET', '/api/kyc', undefined, 'kyc_read');
  must(check(kyc.response, { 'kyc read': r => r.status === 200 }), `KYC读取失败: ${kyc.response.status}`);
  const files = {};
  for (const slot of ['idFront', 'idBack', 'selfie', 'incomeProof']) {
    const uploaded = request('POST', '/api/kyc/files', jpeg, `upload_${slot}`, {
      headers: { 'Content-Type': 'image/jpeg', 'x-kyc-slot': slot },
    });
    uploads.add(1, { slot });
    if (!check(uploaded.response, { [`upload ${slot}`]: r => r.status === 200 })) uploadFailures.add(1, { slot });
    must(uploaded.response.status === 200 && uploaded.body.id, `上传 ${slot} 失败: ${uploaded.response.status}`);
    files[slot] = uploaded.body;
  }

  const submitted = request('POST', '/api/kyc', { action: 'submit', revision: kyc.body.revision, profile: syntheticProfile(files) }, 'kyc_submit');
  must(check(submitted.response, { 'kyc submit': r => r.status === 200 }), `KYC提交失败: ${submitted.response.status}`);
  for (let i = 0; i < 3; i += 1) {
    const state = request('GET', '/api/h5/state', undefined, 'state_poll');
    check(state.response, { 'state poll': r => r.status === 200 });
    sleep(1);
  }
}

export function handleSummary(data) {
  const reportPath = String(__ENV.REPORT_PATH || '/tmp/b0-latest.json');
  const latency = data.metrics.b0_request_latency?.values || {};
  const report = { generatedAt: new Date().toISOString(), baseUrl: base, vus: once ? vus : (stages ? '100→300→600' : vus), duration: once ? 'one iteration' : (stages ? '18m' : duration),
    requestLatency: { ...latency, 'p(50)': latency.med }, requestErrors: data.metrics.b0_request_errors?.values || {},
    uploads: data.metrics.b0_upload_total?.values || {}, uploadFailures: data.metrics.b0_upload_failure_total?.values || {},
    statusCounts: data.metrics.b0_http_status_total?.values || {}, codeCounts: data.metrics.b0_error_code_total?.values || {},
    statusBreakdown: Object.fromEntries(Object.keys(statusMetrics).map(status => [status, data.metrics[`b0_status_${status}`]?.values?.count || 0])),
    codeBreakdown: Object.fromEntries(Object.keys(codeMetrics).map(code => [code, data.metrics[`b0_code_${code}`]?.values?.count || 0])), checks: data.metrics.checks?.values || {} };
  return { stdout: `B0 ${report.vus} VU\nrequest p50=${report.requestLatency['p(50)'] ?? 'n/a'}ms p95=${report.requestLatency['p(95)'] ?? 'n/a'}ms p99=${report.requestLatency['p(99)'] ?? 'n/a'}ms\nerror rate=${report.requestErrors.rate ?? 'n/a'} upload failures=${report.uploadFailures.count ?? 0}\n`, [reportPath]: JSON.stringify(report, null, 2) };
}
