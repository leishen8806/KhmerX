import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';

const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5174';
const outDir = 'docs/reviews/ui-design-diff-20261029/round10';
const fromIndex = process.argv.indexOf('--from');
const from = fromIndex >= 0 ? (process.argv[fromIndex + 1] || 'login') : 'login';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const evidence = { base, from, steps: [], screenshots: [] };

async function shot(name, status, extra = {}) {
  const path = `${outDir}/${name}.jpg`;
  await page.screenshot({ path, fullPage: true, type: 'jpeg', quality: 55 });
  const md5 = crypto.createHash('md5').update(fs.readFileSync(path)).digest('hex');
  const duplicate = evidence.screenshots.find(s => s.md5 === md5);
  if (duplicate) {
    fs.unlinkSync(path);
    evidence.steps.push({ name, status: 'duplicate-skipped', url: page.url(), duplicateOf: duplicate.name, ...extra });
    return;
  }
  evidence.screenshots.push({ name: `${name}.jpg`, status, url: page.url(), md5 });
  evidence.steps.push({ name, status, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 300), ...extra });
}

async function visit(name, path) {
  try {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(300);
    await shot(name, response?.status() < 400 ? 'loaded' : 'http-error', { httpStatus: response?.status() ?? null });
  } catch (error) {
    await shot(name, 'navigation-error', { error: String(error).slice(0, 240) });
  }
}

try {
  if (from === 'login') {
    await visit('01-signin', '/signin-with-chatgpt?return_to=/h5');
    try {
      const tel = page.locator('input[type=tel]');
      await tel.fill('+12025550140');
      await page.locator('button').filter({ hasText: '继续' }).click({ noWaitAfter: true });
      await page.waitForTimeout(250);
      await page.locator('button').filter({ hasText: '验证手机号' }).evaluateAll(bs => { const b = bs.find(x => x.offsetParent); if (b) b.click(); });
      await page.waitForTimeout(250);
      await page.locator('input[type=checkbox]').check();
      await page.locator('button').filter({ hasText: '获取验证码' }).click({ noWaitAfter: true });
      await page.waitForTimeout(250);
      await page.locator('input').fill('123456');
      const wait = page.waitForResponse(r => r.url().includes('/api/h5/auth') && r.request().method() === 'POST', { timeout: 5000 }).catch(() => null);
      await page.locator('button').filter({ hasText: '完成验证' }).click({ noWaitAfter: true });
      const response = await wait;
      await page.waitForTimeout(300);
      await shot('02-verify', response?.status() === 200 ? 'verified' : 'verify-failed', { httpStatus: response?.status() ?? null });
    } catch (error) {
      await shot('02-verify', 'flow-error', { error: String(error).slice(0, 240) });
    }
    await visit('03-home', '/h5');
  }
  for (const [name, path] of [['04-kyc', '/kyc'], ['05-team', '/team'], ['06-review', '/kyc/review'], ['07-loan', '/agreements/loan'], ['08-contract', '/contract']]) await visit(name, path);
  await page.goto(`${base}/h5?lang=zh`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const enButton = page.locator('button').filter({ hasText: 'English' });
  if (await enButton.count()) { await enButton.first().click({ noWaitAfter: true }).catch(() => {}); await page.waitForTimeout(250); }
  await shot('09-h5-zh', 'locale-switched');
  const kmButton = page.locator('button').filter({ hasText: 'Khmer' });
  if (await kmButton.count()) { await kmButton.first().click({ noWaitAfter: true }).catch(() => {}); await page.waitForTimeout(250); }
  await shot('10-h5-km', 'locale-switched');
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit('11-home-1440', '/h5');
  await visit('12-team-1440', '/team');
} finally {
  fs.writeFileSync(`${outDir}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ screenshots: evidence.screenshots.length, steps: evidence.steps.length, from }, null, 2));
