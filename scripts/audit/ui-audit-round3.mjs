import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:5173';
const outDir = 'docs/reviews/ui-design-diff-20261029';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/h5/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const body = await page.locator('body').innerText();
  const inputs = await page.locator('input').count();
  const loginAvailable = inputs > 0;
  await page.screenshot({ path: `${outDir}/h5-375-round3-login-state.png`, fullPage: true });
  results.push({ step: 'demo-login', status: loginAvailable ? 'inputs-present' : 'demo-login-unavailable', url: page.url(), inputCount: inputs, bodyPreview: body.slice(0, 240) });
  for (const [label, file] of [['English', 'h5-375-round3-en.png'], ['Khmer', 'h5-375-round3-km.png']]) {
    const button = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${outDir}/${file}`, fullPage: true });
      results.push({ step: `locale-${label.toLowerCase()}`, status: 'captured', bodyPreview: (await page.locator('body').innerText()).slice(0, 240) });
    } else results.push({ step: `locale-${label.toLowerCase()}`, status: 'control-not-found' });
  }
} finally {
  await browser.close();
}
fs.writeFileSync(`${outDir}/round3-demo-flow-results.json`, JSON.stringify({ base, results }, null, 2));
console.log(JSON.stringify({ base, results }, null, 2));
