// Playwright evidence for the H5 language selector. Run against the local
// scripts/dev-app-backend harness; this never contacts a deployed environment.
// Example:
// PLAYWRIGHT_MODULE=/private/tmp/pw-run/node_modules/playwright/index.mjs \
//   H5_BASE_URL=http://127.0.0.1:8094 \
//   node scripts/dev-app-backend/h5-language-switch.mjs
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.H5_BASE_URL || 'http://127.0.0.1:8092';
const outputDir = process.env.H5_SCREENSHOT_DIR || 'docs/review/assets/acceptance-p2-language';
mkdirSync(outputDir, { recursive: true });

const expected = {
  en: 'Home',
  km: 'ទំព័រដើម',
  zh: '首页',
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/h5`, { waitUntil: 'networkidle' });
  let languageButton = page.locator('.mini-icon-menu-trigger');
  if (!(await languageButton.count())) {
    // The clean local harness has no customer session. Demo mode allows a
    // fictional account to enter the workspace without a real SMS/Telegram
    // message, which gives the selector an actual authenticated Mini App shell.
    await page.goto(`${baseUrl}/h5/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="tel"]').fill(`+1202555${String(Date.now()).slice(-4)}`);
    await page.getByRole('button', { name: /Continue|继续|បន្ត/ }).click();
    await page.waitForURL(`${baseUrl}/h5`);
    languageButton = page.locator('.mini-icon-menu-trigger');
  }
  await languageButton.waitFor();

  for (const locale of ['en', 'km', 'zh']) {
    await languageButton.click();
    const option = page.locator(`button[lang="${locale}"]`);
    await option.waitFor();
    await option.click();
    await page.waitForTimeout(250);
    const rootLocale = await page.locator('.mini-app').getAttribute('lang');
    const bodyText = await page.locator('body').innerText();
    if (rootLocale !== locale) throw new Error(`expected lang=${locale}, got ${rootLocale}`);
    if (!bodyText.includes(expected[locale])) throw new Error(`missing ${expected[locale]} for ${locale}`);
    await page.screenshot({ path: join(outputDir, `h5-language-${locale}.png`), fullPage: true });
    console.log(`${locale}: lang=${rootLocale}; copy=${expected[locale]}`);
  }
} finally {
  await browser.close();
}
