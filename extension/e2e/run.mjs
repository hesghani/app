// End-to-end check: loads the built extension into Chromium, serves stand-in
// Amazon and Merch on Demand sites, and drives every surface, including the
// full "Connect Merch account" flow against three different Merch API styles
// (one of them modeled on a real account where an earlier sync stalled).
// Screenshots go to e2e/out.
//   npm run e2e            (set CHROMIUM_PATH to use a specific browser)

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { API_HOST, ASINS, createMerch, productPage, searchPage } from './fixtures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'e2e', 'out');
await mkdir(out, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const step = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
};

const until = async (fn, { timeout = 30000, interval = 250, message = 'condition' } = {}) => {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timed out waiting for ${message}`);
};

async function launch(style) {
  const profile = await mkdtemp(join(tmpdir(), 'loupe-e2e-'));
  const context = await chromium.launchPersistentContext(profile, {
    // Branded Chrome ignores --load-extension, so use Playwright's Chromium build.
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    headless: true,
    viewport: { width: 1360, height: 900 },
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      // Nothing may reach the real Amazon: anything the stand-in sites don't
      // intercept fails instead (on CI it would otherwise hit a real sign-in page).
      '--host-resolver-rules=MAP *.amazon.com 127.0.0.1, MAP amazon.com 127.0.0.1',
    ],
  });
  const merch = createMerch(style);
  const counters = { productRequests: 0 };
  await context.route(/https:\/\/www\.amazon\.com\/.*/, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/s') return route.fulfill({ contentType: 'text/html', body: searchPage(url.searchParams.get('k') ?? '') });
    if (url.pathname === '/ap/signin') {
      // A signed-in session: Amazon sends you straight back after a moment.
      return route.fulfill({ contentType: 'text/html', body: `<html><body>Signing in…<script>setTimeout(() => location.replace(new URLSearchParams(location.search).get('openid.return_to')), 400)</script></body></html>` });
    }
    const asin = url.pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
    if (asin) {
      counters.productRequests += 1;
      return route.fulfill({ contentType: 'text/html', body: productPage(asin) });
    }
    return route.fulfill({ contentType: 'text/html', body: '<html><body>amazon</body></html>' });
  });
  await context.route(/https:\/\/completion\.amazon\.com\/.*/, (route) => {
    const prefix = new URL(route.request().url()).searchParams.get('prefix') ?? '';
    const suggestions = ['shirt', 'paddle', 'gifts for men', 'dad', 'women', 'funny'].map((s) => ({ value: `${prefix} ${s}`.replace(/\s+/g, ' ') }));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ suggestions }) });
  });
  await context.route(/https:\/\/merch\.amazon\.com\/.*/, (route) => merch.handle(route));
  await context.route((url) => url.href.startsWith(`${API_HOST}/`), (route) => merch.handleApi(route));
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const ext = (path) => `chrome-extension://${extensionId}/${path}`;
  const close = async () => {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  };
  return { context, merch, worker, ext, counters, close };
}

const storage = (page, key) => page.evaluate((k) => chrome.storage.local.get(k).then((r) => r[k]), key);
const dbCount = (page, store) =>
  page.evaluate(
    (s) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('loupe');
        req.onsuccess = () => {
          const r = req.result.transaction(s).objectStore(s).count();
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        };
        req.onerror = () => reject(req.error);
      }),
    store,
  );
const dbAll = (page, store) =>
  page.evaluate(
    (s) =>
      new Promise((resolve) => {
        const req = indexedDB.open('loupe');
        req.onsuccess = () => {
          const r = req.result.transaction(s).objectStore(s).getAll();
          r.onsuccess = () => resolve(r.result);
        };
      }),
    store,
  );

async function connect(dash, label) {
  await dash.evaluate(() => chrome.storage.local.set({ settings: { historyDays: 400 } }));
  const before = (await storage(dash, 'syncState'))?.startedAt ?? 0;
  const context = dash.context();
  const opened = context.waitForEvent('page', { timeout: 15000 });
  const started = Date.now();
  await dash.locator(`button:has-text("${label}")`).first().click();
  // A tab the extension opens can start loading before Playwright's request
  // interception attaches to it (it then shows an error page, which the
  // engine also recovers from by reloading); load it again once attached.
  const tab = await opened;
  await tab.waitForLoadState('domcontentloaded').catch(() => undefined);
  if (!tab.isClosed() && !tab.url().startsWith('https://merch.amazon.com/')) await tab.goto('https://merch.amazon.com/dashboard').catch(() => undefined);
  const s = await until(async () => {
    const s = await storage(dash, 'syncState');
    if (s && (s.startedAt ?? 0) > before && ['done', 'partial', 'error', 'signin'].includes(s.status)) return s;
    return null;
  }, { timeout: 120000, interval: 500, message: 'the connect sync to finish' });
  const seconds = (Date.now() - started) / 1000;
  console.log(`    connect took ${seconds.toFixed(1)} s, ${s.stats?.requests ?? '?'} requests`);
  if (process.env.E2E_DEBUG || s.status !== 'done') console.log((s.log ?? []).map((l) => `      ${l}`).join('\n'));
  return { ...s, seconds, tab };
}

// ---------------------------------------------------------------------------
console.log('Scenario A: research overlays, connect (GET + epoch dates, POST + tokens), agent, alerts, listings');
{
  const { context, merch, worker, ext, counters, close } = await launch('A');
  try {
    await step('opens the welcome page on install', async () => {
      const welcome = await until(() => context.pages().find((p) => p.url().includes('dashboard.html')), { timeout: 5000, message: 'welcome tab' });
      await welcome.waitForSelector('text=Welcome to Loupe');
      await welcome.screenshot({ path: join(out, 'welcome.png') });
      await welcome.close();
    });

    const page = await context.newPage();

    await step('search overlay analyzes every result', async () => {
      await page.goto('https://www.amazon.com/s?k=pickleball');
      await page.locator('loupe-toolbar').waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.querySelector('loupe-toolbar')?.shadowRoot?.textContent?.includes('8 products analyzed'), null, { timeout: 30000 });
      const text = await page.locator('loupe-toolbar').evaluate((el) => el.shadowRoot.textContent);
      assert.match(text, /Niche score/);
      const badges = await page.locator('loupe-badge').evaluateAll((els) => els.map((el) => el.shadowRoot.textContent));
      assert.equal(badges.length, 8);
      assert.match(badges[0], /#18,400/);
      assert.match(badges[7], /Not Merch/);
      await page.screenshot({ path: join(out, 'search.png') });
    });

    await step('sorts by BSR and filters non-Merch in place', async () => {
      const click = (label) => page.locator('loupe-toolbar').evaluate((el, l) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.trim() === l).click(), label);
      await click('Best BSR');
      const order = await page.locator('div[data-component-type="s-search-result"]').evaluateAll((els) => els.map((e) => e.dataset.asin));
      assert.equal(order[0], ASINS[7]);
      await click('Merch only');
      assert.equal(await page.locator(`div[data-asin="${ASINS[7]}"]`).evaluate((el) => el.style.display), 'none');
    });

    await step('serves repeat visits from cache', async () => {
      const before = counters.productRequests;
      await page.reload();
      await page.waitForFunction(() => document.querySelector('loupe-toolbar')?.shadowRoot?.textContent?.includes('8 products analyzed'), null, { timeout: 15000 });
      assert.equal(counters.productRequests, before);
    });

    await step('product panel shows BSR, royalty and trademark check; tracking works', async () => {
      await page.goto(`https://www.amazon.com/dp/${ASINS[0]}`);
      await page.locator('loupe-panel').waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.querySelector('loupe-panel')?.shadowRoot?.textContent?.includes('#18,400'));
      const text = await page.locator('loupe-panel').evaluate((el) => el.shadowRoot.textContent);
      assert.match(text, /Royalty at \$19\.99/);
      await page.locator('loupe-panel').evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.includes('Track BSR')).click());
      await page.waitForFunction(() => document.querySelector('loupe-panel')?.shadowRoot?.textContent?.includes('Tracking'));
      await page.screenshot({ path: join(out, 'product.png') });
    });

    const dash = await context.newPage();
    dash.on('dialog', (d) => { console.log(`    dialog: ${d.message()}`); void d.dismiss(); });
    dash.on('pageerror', (e) => console.log(`    page error: ${e.message}`));
    let merchTab;

    await step('connects the Merch account: discovers, learns, backfills and reads the catalog', async () => {
      await dash.goto(ext('dashboard.html#overview'));
      await dash.waitForSelector('text=Connect Merch account');
      const s = await connect(dash, 'Connect Merch account');
      assert.equal(s.status, 'done', `sync finished as ${s.status}: ${s.phase} ${s.error ?? ''}`);
      const templates = await storage(dash, 'templates');
      assert.deepEqual([...new Set(templates.map((t) => t.kind))].sort(), ['catalog', 'sales']);
      const sales = templates.find((t) => t.kind === 'sales');
      assert.equal(sales.dated, true);
      assert.deepEqual(sales.dates.map((d) => d.format), ['epoch-ms', 'epoch-ms']);
      assert.equal(await dbCount(dash, 'catalog'), merch.listings.length);
      const rows = await dbAll(dash, 'sales');
      assert.ok(rows.length > 300, `sales rows: ${rows.length}`);
      assert.ok(rows.some((r) => r.marketplace === 'DE' && r.currency === 'EUR'), 'German sales downloaded');
      const oldest = rows.reduce((m, r) => (r.date < m ? r.date : m), '9999');
      assert.ok(oldest <= (await storage(dash, 'meta')).coverage.salesFrom, 'history reaches the configured start');
      assert.equal(merch.state.forbidden, 0, 'every replayed request carried the anti-forgery header');
      assert.equal((await storage(dash, 'account')).tier, 1000);
      assert.ok(merch.state.ssoBounced, 'the sign-in bounce happened and the sync carried on');
      assert.ok(!(merch.state.paths['/api/products/search'] > 0 && s.log.some((l) => l.includes('Opening /analyze'))), 'sales came from a known endpoint without opening Analyze');
      assert.ok(s.tab.isClosed(), 'the background tab Loupe opened was closed');
      merchTab = await context.newPage();
      await merchTab.goto('https://merch.amazon.com/dashboard');
      await merchTab.waitForFunction(() => document.querySelector('loupe-dock')?.shadowRoot?.textContent?.includes('Loupe is connected'));
      await merchTab.screenshot({ path: join(out, 'connected.png') });
    });

    await step('agent turns the portfolio into actions', async () => {
      await dash.goto(ext('dashboard.html#agent'));
      await dash.waitForSelector('text=Next best actions');
      const text = await dash.locator('main').textContent();
      assert.match(text, /Replace 12 designs with no sales in the past year/);
      assert.match(text, /Stop uploading to “fishing lure”/);
      assert.match(text, /designs are taking off/);
      assert.match(text, /Make more designs in “pickleball/);
      assert.match(text, /Halloween is in \d+ days: you have 2 designs for it/);
      assert.match(text, /Last year these designs sold \d+ units/);
      assert.match(text, /Put your \d+ best sellers on more products/);
      assert.match(text, /of 1,000 used/);
      await dash.screenshot({ path: join(out, 'agent.png'), fullPage: true });
      await dash.goto(ext('dashboard.html#products'));
      await dash.waitForSelector('text=Fishing Lure Pattern 1 T-Shirt');
      await dash.screenshot({ path: join(out, 'designs.png') });
    });

    await step('a quick sync in your open Merch tab picks up new sales, notifies and updates the badge', async () => {
      merch.state.extraToday = 3;
      const tabsBefore = context.pages().length;
      const before = (await storage(dash, 'syncState')).startedAt;
      await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:start', mode: 'quick', interactive: false }));
      await until(async () => {
        const s = await storage(dash, 'syncState');
        return s.startedAt > before && s.status === 'done';
      }, { timeout: 30000, message: 'quick sync' });
      assert.equal(context.pages().length, tabsBefore, 'used the open Merch tab, opened none');
      const notes = await worker.evaluate(() => new Promise((resolve) => chrome.notifications.getAll(resolve)));
      assert.equal(Object.keys(notes).filter((id) => id.startsWith('sale-')).length, 1, 'one new-sale notification');
      assert.match(await worker.evaluate(() => chrome.action.getBadgeText({})), /^\d+$/);
    });

    await step('dock fills a listing from a draft and flags trademarks', async () => {
      await dash.evaluate(() =>
        chrome.storage.local.set({
          drafts: [{ id: 'd1', name: 'Pickleball', brand: 'Dinkworthy', title: 'Retro Pickleball Legend', bullet1: 'Funny pickleball gift', bullet2: 'Free shipping for Nike fans', description: '', keywords: '', updatedAt: Date.now() }],
        }),
      );
      await merchTab.goto('https://merch.amazon.com/designs/create');
      const dock = merchTab.locator('loupe-dock');
      await dock.waitFor({ state: 'attached' });
      await merchTab.waitForTimeout(800);
      await dock.evaluate((el) => el.shadowRoot.querySelector('button.fab').click());
      await dock.evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Fill').click());
      assert.equal(await merchTab.inputValue('#brand'), 'Dinkworthy');
      assert.equal(await merchTab.inputValue('#b2'), 'Free shipping for Nike fans');
      assert.equal(await merchTab.inputValue('#price'), '19.99');
      await dock.evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.includes('Bullets')).click());
      assert.equal(await merchTab.inputValue('#desc'), 'Funny pickleball gift. Free shipping for Nike fans.');
      await merchTab.waitForFunction(() => document.querySelector('loupe-dock')?.shadowRoot?.textContent?.includes('Nike'));
      await merchTab.screenshot({ path: join(out, 'merch-dock.png') });
    });

    await step('sales overview, dark mode and every page render', async () => {
      const t0 = Date.now();
      const log = (m) => process.env.E2E_DEBUG && console.log(`    [${Date.now() - t0}ms] ${m}`);
      log('goto overview');
      await dash.goto(ext('dashboard.html#overview'));
      log('wait bars');
      await dash.waitForSelector('.chart svg path.bar');
      await dash.locator('.chart').first().hover({ position: { x: 600, y: 120 } });
      await dash.waitForSelector('.chart-tip');
      await dash.screenshot({ path: join(out, 'overview.png'), fullPage: true });
      log('dark');
      await dash.emulateMedia({ colorScheme: 'dark' });
      await dash.goto(ext('dashboard.html#agent'));
      await dash.waitForSelector('text=Next best actions');
      await dash.waitForTimeout(300);
      await dash.screenshot({ path: join(out, 'agent-dark.png') });
      await dash.emulateMedia({ colorScheme: 'light' });
      for (const [hash, text] of [['royalties', 'Price ladder'], ['trademarks', 'Your term lists'], ['listings', 'Pickleball'], ['settings', 'Sync diagnostics']]) {
        log(hash);
        await dash.goto(ext(`dashboard.html#${hash}`));
        log(`${hash} loaded`);
        await dash.waitForSelector(`text=${text}`);
        log(`${hash} found`);
        await dash.screenshot({ path: join(out, `${hash}.png`), fullPage: hash !== 'settings' });
        log(`${hash} shot`);
      }
      log('report');
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ext('').replace(/\/$/, '') }).catch(() => undefined);
      const report = await dash.evaluate(async () => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Copy sync report'));
        btn.click();
        await new Promise((r) => setTimeout(r, 300));
        const read = navigator.clipboard.readText().catch(() => 'clipboard unavailable');
        return Promise.race([read, new Promise((r) => setTimeout(() => r('clipboard unavailable'), 2000))]);
      });
      console.log(`    sync report: ${report === 'clipboard unavailable' ? 'clipboard unavailable in this browser' : `${report.split('\n').length} lines`}`);
      if (report !== 'clipboard unavailable') {
        assert.match(report, /Learned templates \(\d\)/);
        assert.match(report, /Sync log:/);
        assert.match(report, /Requests tried/);
        assert.doesNotMatch(report, /Pickleball|Dinkworthy|a2z-csrf/, 'report contains no titles, brands or header values');
      }
    });

    await step('research expands keywords and scores a niche; watchlist; popup', async () => {
      await dash.goto(ext('dashboard.html#research?q=pickleball&mp=US'));
      await dash.waitForSelector('text=keyword ideas', { timeout: 15000 });
      await dash.locator('button:has-text("Analyze")').first().click();
      await dash.waitForSelector('.pill:has-text("·")', { timeout: 30000 });
      await dash.screenshot({ path: join(out, 'research.png'), fullPage: true });
      await dash.goto(ext('dashboard.html#watchlist'));
      await dash.waitForSelector('text=Retro Pickleball Legend');
      const popup = await context.newPage();
      await popup.setViewportSize({ width: 380, height: 640 });
      await popup.goto(ext('popup.html'));
      await popup.waitForSelector('text=This month');
      await popup.fill('#tm', 'Disney princess best seller');
      await popup.waitForSelector('text=Famous trademark or franchise');
      await popup.screenshot({ path: join(out, 'popup.png'), fullPage: true });
      await popup.close();
    });
  } finally {
    await close();
  }
}

// ---------------------------------------------------------------------------
console.log('Scenario B: sample data first, then connect (POST + ISO dates, undated totals; GET + page numbers)');
{
  const { context, ext, close } = await launch('B');
  try {
    const dash = await until(() => context.pages().find((p) => p.url().includes('dashboard.html')), { timeout: 5000, message: 'welcome tab' });
    await step('sample data shows the agent before connecting', async () => {
      await dash.waitForSelector('text=Load sample data');
      await dash.click('text=Load sample data');
      await dash.waitForSelector('text=Next best actions');
      const text = await dash.locator('main').textContent();
      assert.match(text, /sample data/);
      assert.match(text, /Replace \d+ designs/);
      await dash.screenshot({ path: join(out, 'agent-sample.png'), fullPage: true });
    });

    await step('connect replaces the sample data with the account', async () => {
      const s = await connect(dash, 'Connect Merch account');
      assert.equal(s.status, 'done', `sync finished as ${s.status}: ${s.phase} ${s.error ?? ''}`);
      const meta = await storage(dash, 'meta');
      assert.equal(meta.demo, false);
      const templates = await storage(dash, 'templates');
      const sales = templates.find((t) => t.kind === 'sales');
      assert.equal(sales.dated, false);
      assert.equal(sales.bodyType, 'json');
      const catalog = templates.find((t) => t.kind === 'catalog');
      assert.deepEqual(catalog.pages.map((p) => p.role).sort(), ['page', 'size']);
      const totals = await dbAll(dash, 'totals');
      assert.ok(totals.some((t) => t.days === 365) && totals.some((t) => t.days === 90), 'window totals stored');
      const rows = await dbAll(dash, 'sales');
      assert.ok(rows.length > 50 && rows.every((r) => r.source !== 'demo'), `per-day sales rows: ${rows.length}`);
      assert.equal(await dbCount(dash, 'catalog'), 28);
      await dash.goto(ext('dashboard.html#agent'));
      await dash.waitForSelector('text=Next best actions');
      const text = await dash.locator('main').textContent();
      assert.match(text, /Replace 12 designs with no sales/);
      assert.doesNotMatch(text, /sample data/);
    });
  } finally {
    await close();
  }
}

// ---------------------------------------------------------------------------
console.log('Scenario C: hostile Merch (API on another host, 10-product widget, empty first report, cursor paging, embedded account data)');
{
  const { context, merch, ext, close } = await launch('C');
  try {
    const dash = await until(() => context.pages().find((p) => p.url().includes('dashboard.html')), { timeout: 5000, message: 'welcome tab' });
    await step('connect finishes in under a minute with full history and the whole catalog', async () => {
      await dash.goto(ext('dashboard.html#overview'));
      await dash.waitForSelector('text=Connect Merch account');
      const s = await connect(dash, 'Connect Merch account');
      assert.equal(s.status, 'done', `sync finished as ${s.status}: ${s.phase} ${s.error ?? ''}`);
      assert.ok(s.seconds < 60, `connect took ${s.seconds} s`);
      const templates = await storage(dash, 'templates');
      const sales = templates.find((t) => t.kind === 'sales');
      assert.ok(sales.url.startsWith(API_HOST), 'learned the sales report on the API host');
      assert.ok(sales.rows > 0, 'the empty first report was verified with a wider range');
      assert.equal(await dbCount(dash, 'catalog'), merch.listings.length, 'whole catalog, not the 10-product widget');
      const rows = await dbAll(dash, 'sales');
      assert.ok(rows.length > 300, `sales rows: ${rows.length}`);
      assert.ok(rows.some((r) => r.marketplace === 'DE'), 'German sales downloaded');
      assert.equal((await storage(dash, 'account')).tier, 1000, 'account tier read from data embedded in the page');
      assert.equal(merch.state.forbidden, 0);
    });

    await step('Stop ends a running sync right away', async () => {
      await dash.evaluate(() => chrome.storage.local.set({ meta: {} }));
      await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:start', mode: 'full', interactive: false }));
      await until(async () => (await storage(dash, 'syncState')).status === 'running', { timeout: 5000, message: 'sync running' });
      await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:stop' }));
      const s = await until(async () => {
        const s = await storage(dash, 'syncState');
        return s.status !== 'running' ? s : null;
      }, { timeout: 20000, message: 'sync to stop' });
      assert.equal(s.status, 'idle');
      assert.equal(s.phase, 'Stopped.');
    });
  } finally {
    await close();
  }
}

// ---------------------------------------------------------------------------
console.log("Scenario D: Merch's real API (FindListings search-after paging, range-total reports, rate limiter)");
{
  const { context, merch, ext, close } = await launch('D');
  try {
    const dash = await until(() => context.pages().find((p) => p.url().includes('dashboard.html')), { timeout: 5000, message: 'welcome tab' });
    await step('connect reads every listing with its status, sales history and the tier', async () => {
      await dash.goto(ext('dashboard.html#overview'));
      await dash.waitForSelector('text=Connect Merch account');
      const s = await connect(dash, 'Connect Merch account');
      assert.equal(s.status, 'done', `sync finished as ${s.status}: ${s.phase} ${s.error ?? ''}`);
      assert.ok(s.seconds < 60, `connect took ${s.seconds} s`);
      const catalog = await dbAll(dash, 'catalog');
      assert.equal(catalog.length, merch.listings.length, `every listing, not the 10 on the dashboard (${catalog.length})`);
      assert.ok(catalog.every((i) => i.key.startsWith('L:')), 'keyed by Merch listing id');
      const by = (st) => catalog.filter((i) => i.status === st).length;
      assert.equal(by('processing'), 2, 'PUBLISHING and PROPAGATED are in progress');
      assert.equal(by('rejected'), 1);
      assert.equal(by('live'), merch.listings.length - 3);
      assert.ok(catalog.some((i) => i.status === 'processing' && i.asin === null), 'a listing still publishing has no ASIN yet');
      const templates = await storage(dash, 'templates');
      const sales = templates.find((t) => t.kind === 'sales' && t.rows > 0);
      assert.ok(sales && !sales.dated, 'sales come from a range-total report');
      const rows = await dbAll(dash, 'sales');
      const days = new Set(rows.map((r) => r.date));
      assert.ok(days.size >= 80, `daily history over ~90 days (${days.size} days)`);
      assert.ok(rows.some((r) => r.marketplace === 'DE' && r.currency === 'EUR'), 'German sales in euros');
      const totals = await dbAll(dash, 'totals');
      assert.ok(totals.some((t) => t.days === 365), '365-day totals per product');
      assert.equal((await storage(dash, 'account')).tier, 1000, 'tier from the rate limiter');
      assert.equal(merch.state.forbidden, 0, 'every request carried X-CSRF-Token');
    });

    await step('the next full sync reaches further back in history', async () => {
      const before = (await storage(dash, 'meta')).coverage.salesFrom;
      const started = (await storage(dash, 'syncState')).startedAt;
      await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'sync:start', mode: 'full', interactive: false }));
      const s = await until(async () => {
        const s = await storage(dash, 'syncState');
        return s.startedAt > started && s.status !== 'running' ? s : null;
      }, { timeout: 90000, message: 'second full sync' });
      assert.equal(s.status, 'done', `${s.phase} ${s.error ?? ''}`);
      const after = (await storage(dash, 'meta')).coverage.salesFrom;
      assert.ok(after < before, `history extended from ${before} to ${after}`);
    });
  } finally {
    await close();
  }
}

console.log(`\nAll e2e checks passed. Screenshots in ${out}`);
