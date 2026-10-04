// End-to-end check: loads the built extension into Chromium, serves stand-in
// Amazon and Merch pages, and drives every surface. Screenshots go to e2e/out.
//   npm run e2e            (set CHROMIUM_PATH to use a specific browser)

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { ASINS, merchApi, merchPage, productPage, searchPage } from './fixtures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'e2e', 'out');
await mkdir(out, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const profile = await mkdtemp(join(tmpdir(), 'loupe-e2e-'));
const context = await chromium.launchPersistentContext(profile, {
  // Branded Chrome ignores --load-extension, so use Playwright's Chromium build.
  ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  headless: true,
  viewport: { width: 1360, height: 900 },
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});

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

let productRequests = 0;
await context.route(/https:\/\/www\.amazon\.com\/.*/, (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/s') return route.fulfill({ contentType: 'text/html', body: searchPage(url.searchParams.get('k') ?? '') });
  const asin = url.pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  if (asin) {
    productRequests += 1;
    return route.fulfill({ contentType: 'text/html', body: productPage(asin) });
  }
  return route.fulfill({ contentType: 'text/html', body: '<html><body>amazon</body></html>' });
});
await context.route(/https:\/\/completion\.amazon\.com\/.*/, (route) => {
  const prefix = new URL(route.request().url()).searchParams.get('prefix') ?? '';
  const suggestions = ['shirt', 'paddle', 'gifts for men', 'dad', 'women', 'funny'].map((s) => ({ value: `${prefix} ${s}`.replace(/\s+/g, ' ') }));
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ suggestions }) });
});
await context.route(/https:\/\/merch\.amazon\.com\/.*/, (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(merchApi(url.pathname)) });
  return route.fulfill({ contentType: 'text/html', body: merchPage(url.pathname.includes('create') ? 'create' : 'analyze') });
});

let worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const extensionId = new URL(worker.url()).host;
const ext = (path) => `chrome-extension://${extensionId}/${path}`;
console.log(`Extension ${extensionId}`);

try {
  await step('opens the welcome page on install', async () => {
    const deadline = Date.now() + 5000;
    while (!context.pages().some((p) => p.url().includes('dashboard.html')) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    const welcome = context.pages().find((p) => p.url().includes('dashboard.html'));
    assert.ok(welcome, 'welcome tab opened');
    await welcome.waitForSelector('text=Welcome to Loupe');
    await welcome.screenshot({ path: join(out, 'welcome.png') });
    await welcome.close();
  });

  const page = await context.newPage();

  await step('search overlay analyzes every result', async () => {
    await page.goto('https://www.amazon.com/s?k=pickleball');
    const toolbar = page.locator('loupe-toolbar');
    await toolbar.waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('loupe-toolbar')?.shadowRoot?.textContent?.includes('8 products analyzed'), null, { timeout: 30000 });
    const text = await toolbar.evaluate((el) => el.shadowRoot.textContent);
    assert.match(text, /Niche score/);
    assert.match(text, /Median BSR/);
    const badges = await page.locator('loupe-badge').evaluateAll((els) => els.map((el) => el.shadowRoot.textContent));
    assert.equal(badges.length, 8);
    assert.match(badges[0], /#18,400/);
    assert.match(badges[0], /Merch/);
    assert.match(badges[7], /Not Merch/);
    assert.match(badges[3], /Ad/);
    await page.screenshot({ path: join(out, 'search.png') });
  });

  await step('sorts by BSR and filters non-Merch in place', async () => {
    const shadowClick = (label) =>
      page.locator('loupe-toolbar').evaluate((el, label) => {
        const button = [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
        button.click();
      }, label);
    await shadowClick('Best BSR');
    const order = await page.locator('div[data-component-type="s-search-result"]').evaluateAll((els) => els.map((e) => e.dataset.asin));
    assert.equal(order[0], ASINS[7], 'blank-tee pack (BSR 3,400) sorts first');
    await shadowClick('Merch only');
    const hidden = await page.locator(`div[data-asin="${ASINS[7]}"]`).evaluate((el) => el.style.display);
    assert.equal(hidden, 'none');
    await shadowClick('Amazon');
    await shadowClick('Merch only');
  });

  await step('serves repeat visits from cache', async () => {
    const before = productRequests;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('loupe-toolbar')?.shadowRoot?.textContent?.includes('8 products analyzed'), null, { timeout: 15000 });
    assert.equal(productRequests, before, 'no product pages re-fetched');
  });

  await step('product panel shows BSR, royalty and trademark check; tracking works', async () => {
    await page.goto(`https://www.amazon.com/dp/${ASINS[0]}`);
    const panel = page.locator('loupe-panel');
    await panel.waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('loupe-panel')?.shadowRoot?.textContent?.includes('#18,400'));
    const text = await panel.evaluate((el) => el.shadowRoot.textContent);
    assert.match(text, /Merch on Demand/);
    assert.match(text, /Royalty at \$19\.99/);
    assert.match(text, /\$2\.44/);
    assert.match(text, /Nov 2, 2025/);
    await panel.evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.includes('Track BSR')).click());
    await page.waitForFunction(() => document.querySelector('loupe-panel')?.shadowRoot?.textContent?.includes('Tracking'));
    await page.screenshot({ path: join(out, 'product.png') });
  });

  await step('captures Merch sales from fetch and XHR, then notifies on refresh', async () => {
    await page.goto('https://merch.amazon.com/analyze');
    await page.waitForSelector('text=2 records');
    worker = context.serviceWorkers()[0];
    const read = () => worker.evaluate(() => chrome.storage.local.get(['sales', 'captureLog', 'replay']));
    let state;
    for (let i = 0; i < 30; i++) {
      state = await read();
      if (Object.keys(state.sales ?? {}).length === 2 && state.replay?.length && state.captureLog?.length >= 2) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const rows = Object.values(state.sales);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.units).sort(), [1, 3]);
    assert.equal(rows.find((r) => r.units === 3).royalty, 7.32);
    assert.ok(state.captureLog.some((e) => e.path === '/api/reporting/summary' && e.rows === 0), 'XHR summary was seen');
    assert.equal(state.replay.length, 1);

    const dock = page.locator('loupe-dock');
    await dock.evaluate((el) => el.shadowRoot.querySelector('button.fab').click());
    await dock.evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.includes('Refresh')).click());
    for (let i = 0; i < 30; i++) {
      state = await read();
      if (Object.values(state.sales).some((r) => r.units === 5)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(Object.values(state.sales).some((r) => r.units === 5), 'replayed report updated the day');
    const badge = await worker.evaluate(() => chrome.action.getBadgeText({}));
    assert.equal(badge, '6');
    const notes = await worker.evaluate(() => new Promise((resolve) => chrome.notifications.getAll(resolve)));
    assert.equal(Object.keys(notes).filter((id) => id.startsWith('sale-')).length, 1, 'one new-sale notification, none for the first import');
  });

  await step('dock fills a listing from a draft and flags trademarks', async () => {
    await worker.evaluate(() =>
      chrome.storage.local.set({
        drafts: [{ id: 'd1', name: 'Pickleball', brand: 'Dinkworthy', title: 'Retro Pickleball Legend', bullet1: 'Funny pickleball gift', bullet2: 'Free shipping for Nike fans', description: '', keywords: '', updatedAt: Date.now() }],
      }),
    );
    await page.goto('https://merch.amazon.com/designs/create');
    const dock = page.locator('loupe-dock');
    await dock.waitFor({ state: 'attached' });
    await page.waitForTimeout(800);
    await dock.evaluate((el) => el.shadowRoot.querySelector('button.fab').click());
    await dock.evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Fill').click());
    assert.equal(await page.inputValue('#brand'), 'Dinkworthy');
    assert.equal(await page.inputValue('#title'), 'Retro Pickleball Legend');
    assert.equal(await page.inputValue('#b2'), 'Free shipping for Nike fans');
    assert.equal(await page.inputValue('#price'), '19.99', 'price untouched');
    await dock.evaluate((el) => [...el.shadowRoot.querySelectorAll('button')].find((b) => b.textContent.includes('Bullets')).click());
    assert.equal(await page.inputValue('#desc'), 'Funny pickleball gift. Free shipping for Nike fans.');
    await page.waitForFunction(() => document.querySelector('loupe-dock')?.shadowRoot?.textContent?.includes('Nike'));
    const text = await dock.evaluate((el) => el.shadowRoot.textContent);
    assert.match(text, /free shipping/i);
    await page.screenshot({ path: join(out, 'merch-dock.png') });
  });

  const dash = await context.newPage();

  await step('dashboard overview renders real and sample data', async () => {
    await dash.goto(ext('dashboard.html#overview'));
    await dash.waitForSelector('text=Units sold');
    await dash.evaluate(() => chrome.storage.local.remove('sales'));
    await dash.goto(ext('dashboard.html#welcome'));
    await dash.click('text=Load sample data');
    await dash.waitForSelector('text=sample data');
    await dash.waitForSelector('.chart svg path.bar');
    const bars = await dash.locator('.chart svg path.bar').count();
    assert.ok(bars >= 28, `daily columns rendered (${bars})`);
    await dash.locator('.chart').first().hover({ position: { x: 600, y: 120 } });
    await dash.waitForSelector('.chart-tip');
    await dash.screenshot({ path: join(out, 'overview.png'), fullPage: true });
  });

  await step('dark mode', async () => {
    await dash.emulateMedia({ colorScheme: 'dark' });
    await dash.screenshot({ path: join(out, 'overview-dark.png') });
    await dash.emulateMedia({ colorScheme: 'light' });
  });

  await step('products, royalties, trademarks, listings and settings render', async () => {
    for (const [hash, text] of [
      ['products', 'Days idle'],
      ['royalties', 'Price ladder'],
      ['trademarks', 'Your term lists'],
      ['listings', 'Pickleball'],
      ['settings', 'Sync diagnostics'],
    ]) {
      await dash.goto(ext(`dashboard.html#${hash}`));
      await dash.waitForSelector(`text=${text}`);
      await dash.screenshot({ path: join(out, `${hash}.png`), fullPage: hash !== 'settings' });
    }
    await dash.goto(ext('dashboard.html#royalties'));
    const value = await dash.locator('.stat .value').first().textContent();
    assert.equal(value, '$2.44');
    await dash.goto(ext('dashboard.html#trademarks?q=Funny%20Spiderman%20Olympic%20Tee'));
    await dash.waitForSelector('text=High risk');
  });

  await step('research expands keywords and scores a niche', async () => {
    await dash.goto(ext('dashboard.html#research?q=pickleball&mp=US'));
    await dash.waitForSelector('text=keyword ideas', { timeout: 15000 });
    await dash.locator('button:has-text("Analyze")').first().click();
    await dash.waitForSelector('text=Niche scores');
    await dash.waitForSelector('.pill:has-text("·")', { timeout: 30000 });
    await dash.screenshot({ path: join(out, 'research.png'), fullPage: true });
  });

  await step('watchlist shows the tracked product', async () => {
    await dash.goto(ext('dashboard.html#watchlist'));
    await dash.waitForSelector('text=Retro Pickleball Legend');
    await dash.screenshot({ path: join(out, 'watchlist.png') });
  });

  await step('popup', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 640 });
    await popup.goto(ext('popup.html'));
    await popup.waitForSelector('text=This month');
    await popup.fill('#tm', 'Disney princess best seller');
    await popup.waitForSelector('text=Famous trademark or franchise');
    await popup.screenshot({ path: join(out, 'popup.png'), fullPage: true });
    await popup.close();
  });

  console.log(`\nAll e2e checks passed. Screenshots in ${out}`);
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
