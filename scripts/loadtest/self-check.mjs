import {readFile} from 'node:fs/promises';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const [source, runner, sampler, readme] = await Promise.all([
  read('./b0-main-flow.js'), read('./run-b0.sh'), read('./sample-resources.sh'), read('./README.md'),
]);
const required = [
  "'/api/h5/auth'", "'/api/h5/auth/send'", "'/api/h5/auth/verify'",
  "'/api/kyc'", "'/api/kyc/files'", "'/api/h5/state'",
  "payease.khmerx.org", 'K6_USER_ID', '+1202555', 'idFront', 'incomeProof',
  'p(50)', 'p(95)', 'p(99)', 'b0_error_code_total', 'b0_upload_failure_total',
  'LOADTEST_ALLOWED_HOSTS', 'hostOverrides', 'writeConflictRetries', 'STATE_MUTATION_FAILED',
  'requestsPerSecond', 'totalDurationMs', 'uploadSuccessRate', "action: 'save'",
];
const missing = required.filter(token => !source.includes(token));
if (missing.length) throw new Error(`B0 self-check failed; missing: ${missing.join(', ')}`);
for (const token of ['--origin-ip', '--host', 'LOADTEST_ALLOWED_HOSTS', 'is_production', 'production']) {
  if (!runner.includes(token)) throw new Error(`B0 runner self-check failed; missing: ${token}`);
}
if (/--origin-ip|--host|origin_ip|host_name/.test(sampler)) throw new Error('B0b sampler must not accept load-target arguments');
for (const token of ['159.223.77.134', '165.22.108.5', 'run-b0.sh']) {
  if (!readme.includes(token)) throw new Error(`B0 README self-check failed; missing: ${token}`);
}
if (!readme.includes('不得在压测发起机')) throw new Error('B0b must identify the host sampler must not run on');
console.log(`B0/B0b self-check passed (${source.split('\n').length} flow lines)`);
