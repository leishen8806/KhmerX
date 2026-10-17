import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import encoding from 'k6/encoding';

const originIp = String(__ENV.ORIGIN_IP || '').trim();
const hostHeader = String(__ENV.LOADTEST_HOST || '').trim().toLowerCase();
const originScheme = String(__ENV.ORIGIN_SCHEME || 'https').toLowerCase();
const configuredBase = String(__ENV.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const base = originIp ? `${originScheme}://${hostHeader}` : configuredBase;
const parsedMatch = base.match(/^([a-z][a-z0-9+.-]*):\/\/([^/]+)/i);
if (!parsedMatch) throw new Error('BASE_URL must include http:// or https://');
const parsed = { protocol: `${parsedMatch[1].toLowerCase()}:`, hostname: parsedMatch[2].replace(/^.*@/, '').replace(/:\d+$/, '').toLowerCase().replace(/\.$/, '') };
if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('BASE_URL must use HTTP or HTTPS');
const blocked = ['payease.khmerx.org', 'admin.khmerx.org', 'api.khmerx.org'];
const allowedHosts = new Set(String(__ENV.LOADTEST_ALLOWED_HOSTS || 'localhost,127.0.0.1,10.0.2.2').split(',').map(value => value.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean));
if ((originIp && !hostHeader) || (!originIp && hostHeader)) throw new Error('--origin-ip 与 --host 必须同时提供');
const targetHost = (hostHeader || parsed.hostname).replace(/\.$/, '');
const isProductionHost = host => blocked.some(value => host === value || host.endsWith(`.${value}`));
const validIpv4 = value => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(part => Number(part) <= 255);
if (!/^[a-z0-9.-]+$/.test(targetHost) || (originIp && !validIpv4(originIp)) || isProductionHost(targetHost) || isProductionHost(parsed.hostname)) {
  throw new Error('B0 refuses invalid targets and production hosts, regardless of LOADTEST_ALLOWED_HOSTS');
}
if (!allowedHosts.has(targetHost) || (originIp && !allowedHosts.has(originIp.toLowerCase()))) {
  throw new Error('B0 target host and origin IP must be listed in LOADTEST_ALLOWED_HOSTS');
}
const hostOverrides = originIp ? { [targetHost]: originIp } : undefined;
const requestOrigin = hostHeader ? `${originScheme}://${hostHeader}` : base;

const requestLatency = new Trend('b0_request_latency', true);
const requestErrors = new Rate('b0_request_errors');
const statusCounts = new Counter('b0_http_status_total');
const codeCounts = new Counter('b0_error_code_total');
const uploads = new Counter('b0_upload_total');
const uploadFailures = new Counter('b0_upload_failure_total');
const uploadSuccess = new Rate('b0_upload_success');
const writeConflictResponses = new Counter('b0_write_conflict_response_total');
const stateMutationFailures = new Counter('b0_state_mutation_failed_total');
const finalStateMismatches = new Counter('b0_final_state_mismatch_total');
const statusMetrics = Object.fromEntries([200, 201, 204, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 502, 503, 504].map(status => [status, new Counter(`b0_status_${status}`)]));
statusMetrics.other = new Counter('b0_status_other');
const codeMetrics = Object.fromEntries(['ACCOUNT_ALREADY_REGISTERED', 'AUTH_REQUIRED', 'BROWSER_TOKEN_RATE_LIMITED', 'COMPANY_NOT_FOUND', 'CONFLICT', 'CROSS_SITE_REQUEST', 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'INTERNAL_ERROR', 'INVALID_ARGUMENT', 'INVALID_FILE', 'INVALID_KYC', 'INVALID_PHONE', 'INVALID_REQUEST', 'INVALID_VERIFICATION_CODE', 'KYC_REVISION_CONFLICT', 'KYC_SCAN_REQUIRED', 'NOT_FOUND', 'PAYLOAD_TOO_LARGE', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'STATE_MUTATION_FAILED', 'VALIDATION_FAILED', 'WORKSPACE_PAYLOAD_LIMIT'].map(code => [code, new Counter(`b0_code_${code}`)]));
codeMetrics.other = new Counter('b0_code_other');
let activeJar;
const startedAt = Date.now();

const stages = __ENV.STAGES === 'true';
const once = __ENV.ONCE === 'true';
const scenario = String(__ENV.SCENARIO || 'baseline').trim().toLowerCase();
if (!['baseline', 'rows'].includes(scenario)) throw new Error('SCENARIO must be baseline or rows');
const vus = Number(__ENV.VUS || 50);
const duration = String(__ENV.DURATION || '3m');
export const options = once ? {
  scenarios: { main: { executor: 'per-vu-iterations', vus, iterations: 1, maxDuration: '5m' } },
  thresholds: { b0_request_errors: ['rate<0.05'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  hosts: hostOverrides,
} : stages ? {
  scenarios: { main: { executor: 'ramping-vus', startVUs: 0, stages: [
    { target: 100, duration: '3m' }, { target: 100, duration: '3m' },
    { target: 300, duration: '3m' }, { target: 300, duration: '3m' },
    { target: 600, duration: '3m' }, { target: 600, duration: '3m' },
  ], gracefulRampDown: '30s' } },
  thresholds: { b0_request_errors: ['rate<0.05'], b0_upload_failure_total: ['count<1'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  hosts: hostOverrides,
} : {
  scenarios: { main: { executor: 'constant-vus', vus, duration, gracefulStop: '30s' } },
  thresholds: { b0_request_errors: ['rate<0.05'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  hosts: hostOverrides,
};

const common = {
  headers: {
    Origin: requestOrigin,
    ...(hostHeader ? { Host: hostHeader } : {}),
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
  (statusMetrics[res.status] || statusMetrics.other).add(1);
  let body = {};
  try { body = res.json() || {}; } catch (_) { /* non-JSON failures are recorded below */ }
  if (res.status >= 400) {
    requestErrors.add(true, { endpoint: name });
    if (body.code) {
      codeCounts.add(1, { endpoint: name, code: String(body.code) });
      (codeMetrics[body.code] || codeMetrics.other).add(1);
      if (body.code === 'STATE_MUTATION_FAILED') stateMutationFailures.add(1, { endpoint: name });
    }
    if (res.status === 409 && ['kyc_save', 'kyc_submit', 'h5_state_write'].includes(name)) writeConflictResponses.add(1, { endpoint: name });
  } else requestErrors.add(false, { endpoint: name });
  return body;
}

function request(method, path, body, name, extra = {}) {
  const binary = body instanceof Uint8Array || body instanceof ArrayBuffer;
  const payload = body !== undefined && !binary ? JSON.stringify(body) : body;
  const params = { ...common, ...extra, jar: activeJar, headers: { ...common.headers, ...(extra.headers || {}) } };
  if (body !== undefined && !binary) params.headers['Content-Type'] = 'application/json';
  const response = http.request(method, `${base}${path}`, payload, params);
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
  const phone = `+1202555${String(100 + ((scenario === 'rows' ? __VU : __VU + __ITER) % 100)).padStart(4, '0')}`;
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
    const uploadOk = check(uploaded.response, { [`upload ${slot}`]: r => r.status === 200 });
    uploadSuccess.add(uploadOk, { slot });
    if (!uploadOk) uploadFailures.add(1, { slot });
    must(uploaded.response.status === 200 && uploaded.body.id, `上传 ${slot} 失败: ${uploaded.response.status}`);
    files[slot] = uploaded.body;
  }

  const profile = syntheticProfile(files);
  const saved = request('POST', '/api/kyc', { action: 'save', revision: kyc.body.revision, profile }, 'kyc_save');
  must(check(saved.response, { 'kyc save': r => r.status === 200 }), `KYC保存失败: ${saved.response.status}`);
  const submitted = request('POST', '/api/kyc', { action: 'submit', revision: saved.body.revision, profile }, 'kyc_submit');
  must(check(submitted.response, { 'kyc submit': r => r.status === 200 }), `KYC提交失败: ${submitted.response.status}`);
  let finalState;
  for (let i = 0; i < 3; i += 1) {
    const state = request('GET', '/api/h5/state', undefined, 'state_poll');
    finalState = state.body;
    check(state.response, { 'state poll': r => r.status === 200 });
    sleep(1);
  }
  if (scenario === 'rows' && finalState?.kyc?.status !== 'submitted') finalStateMismatches.add(1, { expected: 'submitted', actual: String(finalState?.kyc?.status || 'missing') });
}

export function handleSummary(data) {
  const reportPath = String(__ENV.REPORT_PATH || 'scripts/loadtest/reports/b0-latest.json');
  const latency = data.metrics.b0_request_latency?.values || {};
  const p50 = latency['p(50)'] ?? latency.med;
  const totalDurationMs = Math.max(Date.now() - startedAt, 1);
  const totalRequests = data.metrics.http_reqs?.values?.count ?? data.metrics.b0_http_status_total?.values?.count ?? 0;
  const requestsPerSecond = totalRequests / (totalDurationMs / 1000);
  const report = { generatedAt: new Date().toISOString(), scenario, baseUrl: base, host: hostHeader || parsed.hostname, originIp: originIp || null, vus: once ? vus : (stages ? '100→300→600' : vus), duration: once ? 'one iteration' : (stages ? '18m' : duration),
    requestsPerSecond, totalRequests, totalDurationMs,
    requestLatency: { ...latency, 'p(50)': p50 }, requestErrors: data.metrics.b0_request_errors?.values || {},
    uploads: data.metrics.b0_upload_total?.values || {}, uploadSuccessRate: data.metrics.b0_upload_success?.values || {}, uploadFailures: data.metrics.b0_upload_failure_total?.values || {},
    writeConflictResponses: data.metrics.b0_write_conflict_response_total?.values?.count || 0,
    writeConflictRetries: { scriptRetryCount: 0, serverOptimisticRetryCount: null, note: 'The script does not retry writes; the API does not expose successful optimistic-lock retry attempts.' },
    stateMutationFailureCount: data.metrics.b0_state_mutation_failed_total?.values?.count || 0,
    finalStateMismatchCount: data.metrics.b0_final_state_mismatch_total?.values?.count || 0,
    statusCounts: data.metrics.b0_http_status_total?.values || {}, codeCounts: data.metrics.b0_error_code_total?.values || {},
    statusBreakdown: Object.fromEntries(Object.keys(statusMetrics).map(status => [status, data.metrics[`b0_status_${status}`]?.values?.count || 0])),
    codeBreakdown: Object.fromEntries(Object.keys(codeMetrics).map(code => [code, data.metrics[`b0_code_${code}`]?.values?.count || 0])), checks: data.metrics.checks?.values || {} };
  return { stdout: `B0 ${report.scenario} ${report.vus} VU\nrps=${report.requestsPerSecond.toFixed(3)} requests=${totalRequests} elapsed=${totalDurationMs}ms p50=${report.requestLatency['p(50)'] ?? 'n/a'}ms p95=${report.requestLatency['p(95)'] ?? 'n/a'}ms p99=${report.requestLatency['p(99)'] ?? 'n/a'}ms\nerror rate=${report.requestErrors.rate ?? 'n/a'} upload success=${report.uploadSuccessRate.rate ?? 'n/a'} write 409=${report.writeConflictResponses} final state mismatches=${report.finalStateMismatchCount} script retries=0 (server retry count unavailable)\n`, [reportPath]: JSON.stringify(report, null, 2) };
}
