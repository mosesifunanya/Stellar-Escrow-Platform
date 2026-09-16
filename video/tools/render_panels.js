const { chromium } = require('playwright-core');
const CHROME = '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const ASSETS = '/workspaces/Stellar-Escrow-Platform/video/assets';
const stages = { s1: 'panel_title', s2: 'panel_problem', s3: 'panel_solution', s4: 'panel_architecture', s7: 'panel_code', s8: 'panel_why', s11: 'panel_tests', s12: 'panel_end' };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`file://${ASSETS}/panels.html`);
  await page.waitForTimeout(600);
  for (const [id, name] of Object.entries(stages)) {
    await page.evaluate((i) => window.show(i), id);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${ASSETS}/${name}.png` });
    console.log('rendered', name);
  }
  await browser.close();
})().catch((e) => { console.error('FAILED:', String(e).slice(0, 300)); process.exit(1); });
