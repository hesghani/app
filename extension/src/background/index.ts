// Service worker: the single writer for sales data, plus notifications, the
// toolbar badge, scheduled watchlist refreshes and context menus.

import { addDays, localDay, pacificDay } from '../shared/dates';
import * as fmt from '../shared/format';
import type { Message } from '../shared/messages';
import { MARKETPLACES, merchSearchUrl } from '../shared/marketplaces';
import { PRODUCT_TYPES } from '../shared/products';
import { mergeSales } from '../shared/sales';
import { get, getSettings, productKey, pruneProducts, saveProduct, set, allProducts } from '../shared/storage';
import type { ProductData, ReplayTemplate, SaleRow } from '../shared/types';

// ---------- Serialized writes ----------

let chain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

// ---------- Sales ----------

async function ingest(rows: SaleRow[]) {
  return serial(async () => {
    const [store, settings, meta] = await Promise.all([get('sales'), getSettings(), get('meta')]);
    const now = Date.now();
    const today = localDay(now);
    const recent = [today, addDays(today, -1), pacificDay(now)];
    // Real data replaces the sample data the first time it arrives.
    const base = meta.demo ? {} : store;
    const result = mergeSales(base, rows, today, recent);
    await set('sales', result.store);
    await set('meta', { ...meta, demo: false, lastCaptureAt: now, lastCaptureRows: rows.length });
    if (settings.notifications && result.newSales.length) notifySales(result.newSales.map((s) => ({ ...s })));
    await refreshBadge();
    return { added: result.added, updated: result.updated, newSales: result.newSales.length };
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
  const sales = await get('sales');
  // Merch reports days in US Pacific time.
  const today = pacificDay(Date.now());
  let units = 0;
  for (const row of Object.values(sales)) if (row.date === today) units += row.units;
  await chrome.action.setBadgeBackgroundColor({ color: '#5546e8' });
  await chrome.action.setBadgeText({ text: units > 0 ? (units > 999 ? '999+' : String(units)) : '' });
  await chrome.action.setTitle({ title: units > 0 ? `Loupe · ${units} sold today` : 'Loupe for Merch on Demand' });
}

// ---------- Capture log and replay templates ----------

async function logCapture(entry: Message & { type: 'capture:log' }) {
  return serial(async () => {
    const log = await get('captureLog');
    const next = [entry.entry, ...log.filter((e) => e.path !== entry.entry.path)].slice(0, 40);
    await set('captureLog', next);
  });
}

function templateKey(url: string): string {
  const u = new URL(url);
  return `${u.pathname}?${Array.from(u.searchParams.keys()).sort().join('&')}`;
}

async function saveTemplate(template: ReplayTemplate) {
  return serial(async () => {
    const list = await get('replay');
    const key = templateKey(template.url);
    await set('replay', [template, ...list.filter((t) => templateKey(t.url) !== key)].slice(0, 6));
  });
}

async function merchTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ url: 'https://merch.amazon.com/*' });
}

async function refreshMerchTabs(): Promise<number> {
  const tabs = await merchTabs();
  await Promise.all(
    tabs.map((tab) => (tab.id ? chrome.tabs.sendMessage(tab.id, { type: 'merch:replay' } satisfies Message).catch(() => undefined) : undefined)),
  );
  return tabs.length;
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
  const meta = await get('meta');
  await set('meta', { ...meta, lastWatchRefresh: Date.now() });
  return { refreshed, failed };
}

// ---------- Alarms ----------

async function scheduleAlarms() {
  const settings = await getSettings();
  await chrome.alarms.create('watchlist', { periodInMinutes: 60, delayInMinutes: 2 });
  await chrome.alarms.create('maintenance', { periodInMinutes: 24 * 60, delayInMinutes: 10 });
  await chrome.alarms.create('badge', { periodInMinutes: 30 });
  if (settings.liveRefresh) {
    await chrome.alarms.create('live', { periodInMinutes: Math.max(5, settings.liveRefreshMinutes) });
  } else {
    await chrome.alarms.clear('live');
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'watchlist') void refreshWatchlist();
  else if (alarm.name === 'live') void refreshMerchTabs();
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
  chrome.notifications.clear(id);
});

// ---------- Messages ----------

chrome.runtime.onMessage.addListener((message: Message & { target?: string }, _sender, respond) => {
  if (message.target === 'offscreen') return false;
  const reply = (p: Promise<unknown>) => {
    p.then(respond, (error: Error) => respond({ error: error.message }));
    return true;
  };
  switch (message.type) {
    case 'open-dashboard': return reply(openDashboard(message.hash));
    case 'sales:ingest': return reply(ingest(message.rows));
    case 'capture:log': return reply(logCapture(message));
    case 'replay:save': return reply(saveTemplate(message.template));
    case 'merch:refresh-all': return reply(refreshMerchTabs().then((tabs) => ({ tabs })));
    case 'watchlist:refresh': return reply(refreshWatchlist(message.keys));
    case 'settings:changed': return reply(Promise.all([scheduleAlarms(), refreshBadge()]));
    case 'badge:refresh': return reply(refreshBadge());
    default: return false;
  }
});

// ---------- Lifecycle ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  const meta = await get('meta');
  if (!meta.installedAt) await set('meta', { ...meta, installedAt: Date.now() });
  createMenus();
  await scheduleAlarms();
  await refreshBadge();
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) await openDashboard('welcome');
});

chrome.runtime.onStartup.addListener(() => {
  void scheduleAlarms();
  void refreshBadge();
});
