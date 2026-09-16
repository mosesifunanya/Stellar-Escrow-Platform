/* Records every UI scene for the pitch video against the REAL app + REAL testnet.
   Usage: node record_scenes.js <phase>   phase = picker | tour | create | act | arbiter | refund
   Writes: video/recordings/<scene>.webm  +  video/recordings/timings.json        */
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const APP = 'http://localhost:5173/';
const REC = '/workspaces/Stellar-Escrow-Platform/video/recordings';
const ASSETS = '/workspaces/Stellar-Escrow-Platform/video/assets';
const ids = JSON.parse(fs.readFileSync('/tmp/demo-identities.json', 'utf8'));

const phase = process.argv[2];
if (!phase) { console.error('usage: node record_scenes.js picker|tour|create|act|arbiter|refund'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(REC, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });

  let timings = {};
  try { timings = JSON.parse(fs.readFileSync(`${REC}/timings.json`, 'utf8')); } catch { timings = {}; }

  function makeCtx(secret) {
    return browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: { dir: REC, size: { width: 1920, height: 1080 } },
    }).then(async (ctx) => {
      if (secret) await ctx.addInitScript((s) => { window.__DEMO_WALLET__ = { secret: s }; }, secret);
      return ctx;
    });
  }

  async function openApp(ctx) {
    const page = await ctx.newPage();
    await page.goto(APP, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => localStorage.setItem('stellarchain-theme', 'dark'));
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1800);
    return page;
  }

  async function finish(ctx, name, meta) {
    await ctx.close(); // flushes the webm
    const files = fs.readdirSync(REC).filter((f) => f.endsWith('.webm') && !/^[a-z_]+\.webm$/.test(f));
    const stat = files.map((f) => ({ f, t: fs.statSync(`${REC}/${f}`).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    if (stat) fs.renameSync(`${REC}/${stat.f}`, `${REC}/${name}.webm`);
    timings[name] = meta;
    fs.writeFileSync(`${REC}/timings.json`, JSON.stringify(timings, null, 2));
    console.log(`recorded ${name}.webm (${JSON.stringify(meta)})`);
  }

  async function waitActionDone(page, busyRegex, maxLoops = 45) {
    for (let i = 0; i < maxLoops; i++) {
      await sleep(2000);
      const b = await page.locator('body').innerText();
      if (!busyRegex.test(b)) return true;
    }
    return false;
  }

  // ============================================================
  // PHASE picker: wallet-picker modal on a clean session (no shim)
  // ============================================================
  if (phase === 'picker') {
    const ctx = await makeCtx(null);
    const page = await openApp(ctx);
    await page.locator('button:has-text("Connect Wallet")').first().click();
    await sleep(2500);
    await page.screenshot({ path: `${ASSETS}/shot_wallet_picker.png` });
    await sleep(1500);
    // hover a couple of wallet options for motion
    const opts = page.locator('[class*="wallet-option"], [class*="option"]');
    const n = await opts.count();
    for (let i = 0; i < Math.min(n, 4); i++) { await opts.nth(i).hover().catch(() => {}); await sleep(500); }
    await finish(ctx, 'picker', { phase, note: 'wallet picker modal' });
  }

  // ============================================================
  // PHASE tour: connected payer session — dashboard, escrows, activity, details
  // ============================================================
  if (phase === 'tour') {
    const ctx = await makeCtx(ids.payer.secret);
    const page = await openApp(ctx);
    await sleep(2000); // let escrows load

    await page.evaluate(() => window.scrollTo({ top: 320, behavior: 'smooth' }));
    await sleep(1400);
    await page.screenshot({ path: `${ASSETS}/shot_dashboard.png` });

    await page.locator('button:has-text("Escrows")').first().click();
    await sleep(1800);
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await sleep(1400);
    await page.screenshot({ path: `${ASSETS}/shot_escrows_list.png` });

    await page.locator('button:has-text("Activity")').first().click();
    await sleep(1800);
    await page.screenshot({ path: `${ASSETS}/shot_activity.png` });

    // back to dashboard, open newest escrow details
    await page.locator('button:has-text("Dashboard")').first().click();
    await sleep(1500);
    const card = page.locator('.escrow-row').first();
    if (await card.count()) {
      await card.click();
      await sleep(2200);
      await page.screenshot({ path: `${ASSETS}/shot_details_modal.png` });
      await page.keyboard.press('Escape');
      await sleep(900);
    } else console.log('no .escrow-row found — check class name');

    await finish(ctx, 'tour', { phase, note: 'dashboard + escrows + activity + details' });
  }

  // ============================================================
  // PHASE create: full create flow → real on-chain escrow (deadline +180s)
  // ============================================================
  if (phase === 'create') {
    const ctx = await makeCtx(ids.payer.secret);
    const page = await openApp(ctx);
    const t0 = Date.now();

    await page.locator('button:has-text("Create Escrow")').first().click();
    await sleep(1400);

    await page.fill('#worker', ids.worker.publicKey); await sleep(700);
    await page.fill('#arbiter', ids.arbiter.publicKey); await sleep(700);
    await page.fill('#amount', '100'); await sleep(700);
    const dl = new Date(Date.now() + 180 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const dt = `${dl.getFullYear()}-${pad(dl.getMonth() + 1)}-${pad(dl.getDate())}T${pad(dl.getHours())}:${pad(dl.getMinutes())}`;
    await page.fill('#deadline', dt); await sleep(900);
    await page.screenshot({ path: `${ASSETS}/shot_create_step1.png` });
    await page.locator('button:has-text("Continue")').first().click();
    await sleep(1400);

    const mAmounts = page.locator('.milestone-amount-input input');
    await mAmounts.nth(0).fill('40'); await sleep(700);
    await page.locator('button:has-text("Add milestone")').first().click(); await sleep(800);
    await mAmounts.nth(1).fill('30'); await sleep(700);
    await page.locator('button:has-text("Add milestone")').first().click(); await sleep(800);
    await mAmounts.nth(2).fill('30'); await sleep(1000);
    await page.screenshot({ path: `${ASSETS}/shot_create_step2.png` });
    await page.locator('button:has-text("Review escrow")').first().click();
    await sleep(1400);

    await page.screenshot({ path: `${ASSETS}/shot_create_review.png` });
    await page.locator('.modal-primary-button:has-text("Create escrow")').first().click();

    const confirmed = await waitActionDone(page, /creating/i, 60);
    console.log('create confirmed:', confirmed);
    await sleep(2000);
    await page.screenshot({ path: `${ASSETS}/shot_created_success.png` });
    await finish(ctx, 'create', { phase, confirmed, seconds: ((Date.now() - t0) / 1000).toFixed(1) });
  }

  // ============================================================
  // PHASE act: release milestone 2 on #10, then open dispute on it
  // ============================================================
  if (phase === 'act') {
    const ctx = await makeCtx(ids.payer.secret);
    const page = await openApp(ctx);
    await sleep(2500);

    // escrow 10 should be the only Active card at this point; open details
    await page.locator('.escrow-row').first().click();
    await sleep(2200);

    // release milestone 2
    const relBtns = page.locator('button:has-text("Release")');
    console.log('release buttons:', await relBtns.count());
    if (await relBtns.count()) {
      await relBtns.first().click();
      await waitActionDone(page, /releasing/i);
      await sleep(1500);
      await page.screenshot({ path: `${ASSETS}/shot_released.png` });
      console.log('milestone released');
    }

    // the app closes the details modal after a release — reopen it
    await sleep(1200);
    await page.locator('.escrow-row').first().click();
    await sleep(2200);

    // open dispute (button in details modal)
    const dispBtn = page.locator('button:has-text("Open Dispute"), button:has-text("Open dispute")').first();
    if (await dispBtn.count()) {
      await dispBtn.click();
      await waitActionDone(page, /opening/i);
      await sleep(1500);
      await page.screenshot({ path: `${ASSETS}/shot_disputed.png` });
      console.log('dispute opened');
    } else console.log('NO dispute button found');

    await finish(ctx, 'act', { phase, note: 'release + dispute on escrow 10' });
  }

  // ============================================================
  // PHASE dispute: payer opens dispute on the Active escrow (#12)
  // ============================================================
  if (phase === 'dispute') {
    const ctx = await makeCtx(ids.payer.secret);
    const page = await openApp(ctx);
    await sleep(2500);

    await page.locator('.escrow-row', { hasText: 'Active' }).first().click();
    await sleep(2200);

    const dispBtn = page.locator('button:has-text("Open Dispute")').first();
    if (await dispBtn.count()) {
      await dispBtn.click();
      await waitActionDone(page, /opening/i);
      await sleep(1800);
      await page.screenshot({ path: `${ASSETS}/shot_disputed.png` });
      console.log('dispute opened');
    } else console.log('NO dispute button found');

    await finish(ctx, 'dispute', { phase, note: 'payer opens dispute' });
  }

  // ============================================================
  // PHASE arbiter: arbiter session resolves dispute for Worker
  // ============================================================
  if (phase === 'arbiter') {
    const ctx = await makeCtx(ids.arbiter.secret);
    const page = await openApp(ctx);
    await sleep(2500);

    await page.locator('.escrow-row', { hasText: 'Disputed' }).first().click();
    await sleep(2200);
    await page.screenshot({ path: `${ASSETS}/shot_arbiter_view.png` });

    const rw = page.locator('button:has-text("Worker Wins")').first();
    if (await rw.count()) {
      await rw.click();
      await waitActionDone(page, /resolving/i);
      await sleep(1800);
      await page.screenshot({ path: `${ASSETS}/shot_resolved.png` });
      console.log('dispute resolved for worker');
    } else console.log('NO resolve-worker button for arbiter');

    await finish(ctx, 'arbiter', { phase, note: 'arbiter resolves for worker' });
  }

  // ============================================================
  // PHASE refund: after escrow 11 deadline passes → real deadline refund
  // ============================================================
  if (phase === 'refund') {
    const ctx = await makeCtx(ids.payer.secret);
    const page = await openApp(ctx);
    await sleep(2500);

    // escrow 11 = the Active row (escrow 10 is Released by now)
    const cards = page.locator('.escrow-row');
    const activeRow = page.locator('.escrow-row', { hasText: 'Active' }).first();
    console.log('cards:', await cards.count(), '| active rows:', await page.locator('.escrow-row', { hasText: 'Active' }).count());
    await activeRow.click();
    await sleep(2200);

    const refBtn = page.locator('button:has-text("Refund")').first();
    if (await refBtn.count() && await refBtn.isEnabled().catch(() => false)) {
      await refBtn.click();
      await waitActionDone(page, /refunding/i);
      await sleep(1800);
      await page.screenshot({ path: `${ASSETS}/shot_refunded.png` });
      console.log('refund executed');
    } else console.log('refund button missing or disabled (deadline not passed?)');

    await finish(ctx, 'refund', { phase, note: 'deadline refund on escrow 11' });
  }

  await browser.close();
  console.log('PHASE DONE:', phase);
})().catch((e) => { console.error('RECORD FAILED:', String(e).slice(0, 500)); process.exit(1); });
