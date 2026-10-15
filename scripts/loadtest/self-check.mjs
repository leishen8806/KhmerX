import {readFile} from 'node:fs/promises';

const file = new URL('./b0-main-flow.js', import.meta.url);
const source = await readFile(file, 'utf8');
const required = [
  "'/api/h5/auth'", "'/api/h5/auth/send'", "'/api/h5/auth/verify'",
  "'/api/kyc'", "'/api/kyc/files'", "'/api/h5/state'",
  "payease.khmerx.org", 'K6_USER_ID', '+1202555', 'idFront', 'incomeProof',
  'p(50)', 'p(95)', 'p(99)', 'b0_error_code_total', 'b0_upload_failure_total',
];
const missing = required.filter(token => !source.includes(token));
if (missing.length) throw new Error(`B0 self-check failed; missing: ${missing.join(', ')}`);
if (!source.includes("blocked.has(parsed.hostname)")) throw new Error('B0 production host guard missing');
console.log(`B0 self-check passed (${source.split('\n').length} lines)`);
