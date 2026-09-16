const { chromium } = require('playwright-core');
const CHROME = '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: '/tmp/pwtest', size: { width: 1920, height: 1080 } } });
  await ctx.addInitScript(() => { window.__DEMO_WALLET__ = { secret: 'SCJ33GIWXA44PIE72CAGKF6A75YUXL2MEHYFAHSDFWS53HFJAHIGUBID' }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.evaluate(() => localStorage.setItem('stellarchain-theme', 'dark'));
  await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);

  console.log('exact /connect wallet/i count:', await page.getByRole('button', { name: /connect wallet/i }).count());
  console.log('text= count:', await page.locator('button:has-text("Connect Wallet")').count());
  console.log('visible count:', await page.locator('button:has-text("Connect Wallet")').locator('visible=true').count());
  for (const b of await page.locator('button:has-text("Connect Wallet")').all()) {
    console.log('  btn:', JSON.stringify((await b.innerText()).slice(0, 40)), 'visible=', await b.isVisible(), 'disabled=', await b.isDisabled());
  }
  // try the click
  await page.locator('button:has-text("Connect Wallet")').first().click({ timeout: 5000 }).then(() => console.log('CLICK OK')).catch((e) => console.log('CLICK FAIL:', String(e).slice(0, 200)));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/after_connect.png' });
  console.log('body now:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400));
  await browser.close();
})().catch((e) => { console.error('FAILED:', String(e).slice(0, 300)); process.exit(1); });
