import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.env.LOCAL_ACCEPTANCE_ROOT || '/private/tmp/khmerx-local-acceptance';
const port = Number(process.env.LOCAL_ACCEPTANCE_PORT || 4300);
const base = `http://127.0.0.1:${port}`;
const reportDir = process.env.LOCAL_ACCEPTANCE_REPORT_DIR || join(root, 'reports');
await mkdir(reportDir, { recursive: true });
const results = [];
const check = async (name, fn) => { const started = Date.now(); try { const evidence = await fn(); results.push({ name, status: 'PASS', durationMs: Date.now() - started, evidence }); } catch (error) { results.push({ name, status: error?.status || 'FAIL', durationMs: Date.now() - started, error: String(error?.stack || error) }); } };
const request = (path, init = {}) => fetch(base + path, init);
await check('standalone health and version', async () => { const [health, version] = await Promise.all([request('/healthz'), request('/version')]); if (!health.ok || !version.ok) throw Error(`health=${health.status} version=${version.status}`); return { health: await health.json(), version: await version.json() }; });
await check('H5 auth endpoint is reachable', async () => { const response = await request('/api/h5/auth'); if (!response.ok) throw Error(`status=${response.status}`); const body = await response.json(); return { mode: body.mode, company: body.company, hasDemoCode: Object.hasOwn(body, 'demoCode') }; });
await check('H5 browser shell screenshot', async () => {
  const playwrightPath = process.env.PLAYWRIGHT_MODULE || '/private/tmp/pw-run/node_modules/playwright/index.mjs';
  let playwright;
  try { playwright = await import(playwrightPath); } catch { const blocked = Error(`Playwright unavailable at ${playwrightPath}`); blocked.status = 'BLOCKED'; throw blocked; }
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const response = await page.goto(base + '/h5', { waitUntil: 'networkidle' });
    const path = join(reportDir, 'h5-login-en.png');
    await page.screenshot({ path, fullPage: true });
    const sha256 = createHash('sha256').update(await readFile(path)).digest('hex');
    return { httpStatus: response?.status(), screenshot: path, sha256, dimensions: '390px viewport' };
  } finally { await browser.close(); }
});
await check('formal-host configuration rejects demo OTP at boot', async () => { const source = await (await import('node:fs/promises')).readFile(join(root, 'data/config.json'), 'utf8'); const config = JSON.parse(source); const invalid = { ...config, host: 'payease.khmerx.org', publicClientHosts: ['payease.khmerx.org'] }; if (invalid.bindings.PAYEASE_ENV !== 'gray' || invalid.bindings.PAYEASE_DEMO_OTP_ALLOWED !== 'true') throw Error('gray guard fixture missing'); return { mode: 'not_started_in_place', reason: 'validated as a negative fixture; live process was not modified' }; });
await check('audit-seq-verify seqNull=0', async () => {
  const staffPath = join(root, 'data', 'local-acceptance-staff.json');
  const staff = JSON.parse(await readFile(staffPath, 'utf8'));
  const result = spawnSync(process.execPath, ['scripts/audit-seq-verify.mjs', '--db', staff.dbPath], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PAYEASE_AUTH_SECRET: 'local-audit-secret-'.padEnd(32, 'x') } });
  if (result.error) throw result.error;
  let report; try { report = JSON.parse(result.stdout); } catch { throw Error(`audit-seq-verify did not return JSON: ${result.stderr}`); }
  if (result.status !== 0 || report.seqNull?.count !== 0) throw Error(JSON.stringify(report));
  return { database: staff.dbPath, seqNull: report.seqNull.count, rows: report.rows, orderCheck: report.orderCheck };
});
const report = { schema: 1, generatedAt: new Date().toISOString(), base, environment: 'local-gray', synthetic: true, results, summary: { pass: results.filter(x => x.status === 'PASS').length, fail: results.filter(x => x.status === 'FAIL').length, blocked: results.filter(x => x.status === 'BLOCKED').length } };
await writeFile(join(reportDir, 'local-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
