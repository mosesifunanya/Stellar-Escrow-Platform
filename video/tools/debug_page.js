const { chromium } = require('playwright-core');
const CHROME = '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 250)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 400)));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  console.log('=== BODY ===');
  console.log((await page.locator('body').innerText()).slice(0, 1200));
  console.log('=== BUTTONS ===', JSON.stringify((await page.locator('button').allInnerTexts()).slice(0, 25)));
  await page.screenshot({ path: '/tmp/debug_home.png' });
  console.log('=== ERRORS ===', JSON.stringify(errs.slice(0, 10), null, 1));
  await browser.close();
})().catch((e) => { console.error('DEBUG FAILED:', String(e).slice(0, 300)); process.exit(1); });
