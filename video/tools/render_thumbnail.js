const { chromium } = require('playwright-core');
const CHROME = '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const ASSETS = '/workspaces/Stellar-Escrow-Platform/video/assets';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`file://${ASSETS}/thumbnail.html`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${ASSETS}/video_thumbnail.png` });
  console.log('thumbnail rendered');
  await browser.close();
})().catch((e) => { console.error('FAILED:', String(e).slice(0, 200)); process.exit(1); });
