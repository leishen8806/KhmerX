#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve('docs/reviews/ui-design-diff-20261029');
fs.mkdirSync(out, { recursive: true });
const targets = [
  ['h5-login', '/h5/login'], ['h5-home', '/h5'], ['kyc', '/h5/kyc'],
  ['contract', '/h5/contract'], ['website', '/khmerx-website/index.html'],
];
const viewports = [375, 768, 1440];
const browser = await chromium.launch({ headless: true });
const rows = [];
for (const [name, route] of targets) {
  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'light' });
    const started = new Date().toISOString();
    let status = 'loaded';
    let text = '';
    try {
      await page.goto(`http://127.0.0.1:5173${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);
      text = (await page.locator('body').innerText()).slice(0, 240).replace(/\s+/g, ' ');
      await page.screenshot({ path: path.join(out, `${name}-${width}-light.png`), fullPage: true });
    } catch (e) { status = `error:${e.message.split('\n')[0]}`; }
    rows.push({ name, route, width, colorScheme: 'light', started, status, bodyPreview: text });
    await page.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(out, 'round2-capture-results.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ count: rows.length, out }, null, 2));
