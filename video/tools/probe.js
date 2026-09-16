const { chromium } = require('playwright-core');
const { execSync } = require('child_process');

const APP_URL = 'https://stellar-escrow-platform.vercel.app/';
const OUT = '/workspaces/Stellar-Escrow-Platform/video/assets/probe';

(async () => {
  execSync(`mkdir -p ${OUT}`);
  const browser = await chromium.launch({
    executablePath: '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio'],
  });

  const page = await browser.newPage({ viewport: { width: 1940, height: 1090 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const apiCalls = [];

  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('request', (r) => {
    const u = r.url();
    if (/api|escrow|soroban|friendbot|5000|onrender|render\.com/i.test(u)) apiCalls.push(r.method() + ' ' + u.slice(0, 130));
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  console.log('=== BODY TEXT ===');
  console.log((await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1600));

  console.log('=== BUTTONS ===');
  console.log(JSON.stringify((await page.locator('button').allInnerTexts()).slice(0, 30)));

  const inputs = await page.locator('input, textarea, select').evaluateAll((els) =>
    els.map((e) => e.placeholder || e.type || e.tagName).filter(Boolean).slice(0, 25)
  );
  console.log('=== INPUTS ===', JSON.stringify(inputs));

  // Try opening the Create Escrow modal (may require wallet first)
  const createBtn = page.locator('button', { hasText: /create escrow/i }).first();
  if (await createBtn.count()) {
    await createBtn.click().catch(() => {});
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/after_create_click.png` });
    console.log('=== AFTER CREATE CLICK ===');
    console.log((await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1200));
  } else {
    console.log('NO create-escrow button visible without wallet');
  }

  await page.screenshot({ path: `${OUT}/landing.png`, fullPage: true });
  console.log('=== API/CONTRACT REQUESTS SEEN ===');
  console.log(JSON.stringify(apiCalls.slice(0, 25), null, 1));
  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors.slice(0, 8), null, 1));

  await browser.close();
})().catch((e) => { console.error('PROBE FAILED:', String(e).slice(0, 400)); process.exit(1); });
