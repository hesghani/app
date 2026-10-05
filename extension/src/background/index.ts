// Service worker: the single writer for sales and catalog data, home of the
// sync engine (sync.ts), notifications, the toolbar badge, scheduled
// refreshes and context menus.

import { bump, clearStore, count, deleteMany, getAll, getMany, putMany, salesBetween, type Keyed } from '../shared/db';
import { addDays, localDay, pacificDay } from '../shared/dates';
import * as fmt from '../shared/format';
import { rankTemplates, type Template } from '../shared/learn';
import type { Message } from '../shared/messages';
import { MARKETPLACES, merchSearchUrl } from '../shared/marketplaces';
import { PRODUCT_TYPES } from '../shared/products';
import { mergeSales, rowKey } from '../shared/sales';
import { get, getSettings, productKey, pruneProducts, saveProduct, set, allProducts, update } from '../shared/storage';
import type { AccountFacts, CaptureLogEntry, CatalogItem, ProductData, RangeTotal, SaleRow } from '../shared/types';
import { MERCH, configureSync, onTabUpdated, startSync, stopSync, syncActive, watchdog } from './sync';

// ---------- Serialized writes ----------

let chain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

// ---------- One-time move of sales from chrome.storage to IndexedDB ----------

async function migrate() {
  const meta = await get('meta');
  if (meta.migratedToDb) return;
  const legacy = await get('sales');
  const rows = Object.values(legacy);
  if (rows.length) await putMany('sales', rows.map((r) => ({ ...r, key: rowKey(r) })));
  await chrome.storage.local.remove('sales');
  await chrome.storage.local.remove('replay');
  await set('meta', { ...meta, migratedToDb: true });
  if (rows.length) await bump('sales');
}

// ---------- Sales, totals, catalog ----------

/** Real data replaces all sample data the first time any of it arrives. */
async function leaveDemo() {
  const meta = await get('meta');
  if (!meta.demo) return meta;
  await Promise.all([clearStore('sales'), clearStore('catalog'), clearStore('totals')]);
  const next = { ...meta, demo: false, knownMarkets: [] };
  await set('meta', next);
  await bump('sales', 'catalog', 'totals');
  return next;
}

async function ingestSales(rows: SaleRow[]) {
  return serial(async () => {
    const settings = await getSettings();
    const meta = await leaveDemo();
    const now = Date.now();
    const today = localDay(now);
    const recent = [today, addDays(today, -1), pacificDay(now), addDays(pacificDay(now), -1)];
    const keys = rows.map((r) => rowKey(r));
    const existing = await getMany('sales', keys);
    const firstImport = (await count('sales')) === 0;
    const prev: Record<string, SaleRow> = {};
    for (const [k, v] of existing) prev[k] = v;
    const result = mergeSales(prev, rows, today, recent, firstImport);
    const changed = keys.filter((k) => result.store[k] !== prev[k]).map((k) => ({ ...result.store[k]!, key: k }));
    await putMany('sales', changed as Array<Keyed<SaleRow>>);
    // The first rows from a marketplace are history being backfilled, not new sales.
    const known = new Set(meta.knownMarkets ?? []);
    const fresh = result.newSales.filter((s) => known.has(s.row.marketplace));
    for (const r of rows) known.add(r.marketplace);
    await update('meta', (m) => ({ ...m, demo: false, lastCaptureAt: now, lastCaptureRows: rows.length, knownMarkets: Array.from(known) }));
    if (changed.length) await bump('sales');
    if (settings.notifications && fresh.length) notifySales(fresh);
    await refreshBadge();
    return { added: result.added, updated: result.updated, newSales: result.newSales.length };
  });
}

async function ingestTotals(totals: RangeTotal[]) {
  return serial(async () => {
    await leaveDemo();
    await putMany('totals', totals);
    await bump('totals');
  });
}

/** Items without a known marketplace (from widgets and summaries) are placeholders until the real listing arrives. */
const partial = (key: string) => key.startsWith('XX:') || key.startsWith('id:');

async function ingestCatalog(items: CatalogItem[]) {
  return serial(async () => {
    await leaveDemo();
    const all = await getAll('catalog');
    const knownAsins = new Set(all.filter((i) => !partial(i.key) && i.asin).map((i) => i.asin));
    for (const i of items) if (!partial(i.key) && i.asin) knownAsins.add(i.asin);
    // A widget's copy of a product Loupe already has in full adds nothing.
    const incoming = items.filter((i) => !(partial(i.key) && i.asin && knownAsins.has(i.asin)));
    const byKey = new Map(all.map((i) => [i.key, i]));
    const merged = incoming.map((i) => {
      const prev = byKey.get(i.key);
      return prev ? { ...prev, ...i, createdAt: i.createdAt ?? prev.createdAt, image: i.image ?? prev.image, designId: i.designId ?? prev.designId } : i;
    });
    // ...and the full listing replaces the placeholder.
    const replaced = all.filter((i) => partial(i.key) && i.asin && knownAsins.has(i.asin)).map((i) => i.key);
    await putMany('catalog', merged);
    await deleteMany('catalog', replaced);
    if (merged.length || replaced.length) await bump('catalog');
  });
}

/** After a complete catalog read: live listings that weren't returned are no longer live, and placeholders go. */
async function catalogComplete(startedAt: number) {
  return serial(async () => {
    const stale = (await getAll('catalog')).filter((i) => i.seenAt < startedAt);
    const placeholders = stale.filter((i) => partial(i.key)).map((i) => i.key);
    const gone = stale.filter((i) => !partial(i.key) && i.status === 'live');
    if (!placeholders.length && !gone.length) return;
    await putMany('catalog', gone.map((i) => ({ ...i, status: 'removed' as const, rawStatus: 'not listed' })));
    await deleteMany('catalog', placeholders);
    await bump('catalog');
  });
}

async function mergeAccount(account: AccountFacts) {
  return serial(async () => {
    const prev = await get('account');
    await set('account', { tier: account.tier ?? prev?.tier, facts: { ...(prev?.facts ?? {}), ...account.facts }, seenAt: account.seenAt });
  });
}

function notifySales(sales: Array<{ row: SaleRow; units: number; royalty: number }>) {
  const units = sales.reduce((n, s) => n + s.units, 0);
  const lines = sales.slice(0, 3).map((s) => {
    const type = s.row.productType ? PRODUCT_TYPES[s.row.productType].short : 'Product';
    const name = s.row.title || s.row.asin;
    const royalty = s.royalty > 0 ? ` · +${fmt.money(s.royalty, s.row.currency)}` : '';
    return `${MARKETPLACES[s.row.marketplace].flag} ${s.units}× ${type}: ${name}${royalty}`;
  });
  if (sales.length > 3) lines.push(`and ${sales.length - 3} more`);
  chrome.notifications.create(`sale-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: units === 1 ? 'New sale' : `${units} new sales`,
    message: lines.join('\n'),
    priority: 1,
  });
}

async function refreshBadge() {
  const settings = await getSettings();
  if (!settings.badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  // Merch reports days in US Pacific time.
  const today = pacificDay(Date.now());
  const units = (await salesBetween(today, today)).reduce((n, r) => n + r.units, 0);
  await chrome.action.setBadgeBackgroundColor({ color: '#5546e8' });
  await chrome.action.setBadgeText({ text: units > 0 ? (units > 999 ? '999+' : String(units)) : '' });
  await chrome.action.setTitle({ title: units > 0 ? `Loupe · ${units} sold today` : 'Loupe for Merch on Demand' });
}

// ---------- Templates and the capture log ----------

async function saveTemplate(template: Template, tabId?: number) {
  const firstSales = await serial(async () => {
    const list = await get('templates');
    const hadSales = list.some((t) => t.kind === 'sales');
    const next = rankTemplates([template, ...list.filter((t) => t.id !== template.id)]);
    // Keep the best few of each kind.
    const keep = [...next.filter((t) => t.kind === 'sales').slice(0, 6), ...next.filter((t) => t.kind === 'catalog').slice(0, 6)];
    await set('templates', keep);
    return !hadSales && template.kind === 'sales';
  });
  // The first time Loupe learns the sales report, download the history right away.
  if (firstSales && tabId !== undefined && !syncActive()) await startSync('full', false, tabId);
}

async function logCapture(entry: CaptureLogEntry) {
  return serial(async () => {
    const log = await get('captureLog');
    const id = entry.request ?? entry.path;
    await set('captureLog', [entry, ...log.filter((e) => (e.request ?? e.path) !== id)].slice(0, 60));
  });
}

// ---------- Sync ----------

configureSync({ ingestSales, ingestTotals, ingestCatalog, catalogComplete, mergeAccount, saveTemplate: (t) => saveTemplate(t), refreshBadge });

const MERCH_HOME = `${MERCH}/dashboard`;

chrome.tabs.onUpdated.addListener((tabId, change, tab) => void onTabUpdated(tabId, change, tab));

async function autoSync() {
  const [settings, meta, s] = await Promise.all([getSettings(), get('meta'), get('syncState')]);
  if (!settings.autoSync || syncActive()) return;
  // Never connected: a first sync is the user's call.
  if (!(await get('templates')).length) return;
  // Signed out: don't keep opening Merch every half hour. Try again in a few hours.
  if (s.status === 'signin' && Date.now() - (s.finishedAt ?? 0) < 6 * 3600_000) return;
  const catalogStale = Date.now() - (meta.coverage?.catalogAt ?? 0) > 24 * 3600_000;
  await startSync(catalogStale ? 'full' : 'quick', false);
}

// ---------- Watchlist refresh through the offscreen document ----------

let creating: Promise<void> | null = null;
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (contexts.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: 'Parse Amazon product pages to refresh the BSR of tracked products.',
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

interface OffscreenReply { data?: ProductData; error?: string; captcha?: boolean }

async function refreshWatchlist(keys?: string[]) {
  const settings = await getSettings();
  const products = (await allProducts()).filter((p) => p.tracked);
  const due = keys?.length
    ? products.filter((p) => keys.includes(productKey(p.marketplace, p.asin)))
    : products
        .filter((p) => Date.now() - p.fetchedAt > settings.watchRefreshHours * 3600_000)
        .sort((a, b) => a.fetchedAt - b.fetchedAt)
        .slice(0, 25);
  if (!due.length) return { refreshed: 0, failed: 0 };
  await ensureOffscreen();
  let refreshed = 0;
  let failed = 0;
  for (const p of due) {
    const reply = (await chrome.runtime.sendMessage({ target: 'offscreen', type: 'fetch-product', mp: p.marketplace, asin: p.asin })) as OffscreenReply;
    if (reply?.data) {
      await saveProduct(reply.data);
      refreshed += 1;
    } else {
      failed += 1;
      if (reply?.captcha) break;
    }
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
  }
  await update('meta', (m) => ({ ...m, lastWatchRefresh: Date.now() }));
  return { refreshed, failed };
}

// ---------- Alarms ----------

async function scheduleAlarms() {
  const settings = await getSettings();
  await chrome.alarms.create('watchlist', { periodInMinutes: 60, delayInMinutes: 2 });
  await chrome.alarms.create('maintenance', { periodInMinutes: 24 * 60, delayInMinutes: 10 });
  await chrome.alarms.create('badge', { periodInMinutes: 30 });
  await chrome.alarms.create('autosync', { periodInMinutes: Math.max(10, settings.syncMinutes), delayInMinutes: 1 });
  await chrome.alarms.clear('live');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'watchlist') void refreshWatchlist();
  else if (alarm.name === 'autosync') void autoSync();
  else if (alarm.name === 'syncwatch') void watchdog();
  else if (alarm.name === 'badge') void refreshBadge();
  else if (alarm.name === 'maintenance') void pruneProducts(30);
});

// ---------- Context menus ----------

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'loupe-search', title: 'Search Merch shirts for “%s”', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'loupe-keywords', title: 'Keyword ideas for “%s”', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'loupe-tm', title: 'Trademark check “%s”', contexts: ['selection'] });
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const text = (info.selectionText ?? '').trim().slice(0, 200);
  if (!text) return;
  const settings = await getSettings();
  if (info.menuItemId === 'loupe-search') {
    await chrome.tabs.create({ url: merchSearchUrl(settings.marketplace, text, settings.searchTemplates[settings.marketplace]) });
  } else if (info.menuItemId === 'loupe-keywords') {
    await openDashboard(`research?q=${encodeURIComponent(text)}`);
  } else if (info.menuItemId === 'loupe-tm') {
    await openDashboard(`trademarks?q=${encodeURIComponent(text)}`);
  }
});

// ---------- Dashboard ----------

async function openDashboard(hash = '') {
  const base = chrome.runtime.getURL('dashboard.html');
  const url = hash ? `${base}#${hash}` : base;
  const existing = await chrome.tabs.query({ url: `${base}*` }).catch(() => [] as chrome.tabs.Tab[]);
  const tab = existing[0];
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url, active: true });
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith('sale-')) void openDashboard('overview');
  if (id === 'signin') void chrome.tabs.create({ url: MERCH_HOME });
  chrome.notifications.clear(id);
});

// ---------- Messages ----------

chrome.runtime.onMessage.addListener((message: Message & { target?: string }, sender, respond) => {
  if (message.target === 'offscreen') return false;
  const reply = (p: Promise<unknown>) => {
    p.then(respond, (error: Error) => respond({ error: error.message }));
    return true;
  };
  switch (message.type) {
    case 'open-dashboard': return reply(openDashboard(message.hash));
    case 'sales:ingest': return reply(ingestSales(message.rows));
    case 'totals:ingest': return reply(ingestTotals(message.totals));
    case 'catalog:ingest': return reply(ingestCatalog(message.items));
    case 'catalog:complete': return reply(catalogComplete(message.startedAt));
    case 'account:merge': return reply(mergeAccount(message.account));
    case 'template:save': return reply(saveTemplate(message.template, sender.tab?.id));
    case 'capture:log': return reply(logCapture(message.entry));
    case 'sync:start': return reply(startSync(message.mode, message.interactive));
    case 'sync:stop': return reply(stopSync().then(() => ({ stopping: true })));
    case 'watchlist:refresh': return reply(refreshWatchlist(message.keys));
    case 'settings:changed': return reply(Promise.all([scheduleAlarms(), refreshBadge()]));
    case 'badge:refresh': return reply(refreshBadge());
    default: return false;
  }
});

// ---------- Lifecycle ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  await migrate();
  const meta = await get('meta');
  if (!meta.installedAt) await set('meta', { ...meta, installedAt: Date.now() });
  createMenus();
  await scheduleAlarms();
  await refreshBadge();
  await endStaleSync();
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) await openDashboard('welcome');
});

chrome.runtime.onStartup.addListener(() => {
  void migrate().then(() => Promise.all([scheduleAlarms(), refreshBadge(), endStaleSync()]));
});

/** A sync that was running when the browser closed is over. */
async function endStaleSync() {
  const s = await get('syncState');
  if (s.status === 'running' && !syncActive()) await set('syncState', { ...s, status: 'idle', phase: 'The last sync was interrupted when the browser closed.', finishedAt: Date.now() });
}
