// The sync engine. It runs entirely in the service worker and uses a
// merch.amazon.com tab only as the place where requests execute, with your
// signed-in session and Merch's own origin (chrome.scripting, page world).
// Nothing depends on a page script surviving a navigation; every request and
// every step has a timeout; every step is logged to the sync state.
//
// How it finds your data, fastest first:
//  1. Requests it already learned from your account (verified each run).
//  2. Merch endpoints known to serve sales, products and account data.
//  3. API paths written in Merch's own scripts, which it reads in the tab.
//  4. Data the Merch page loaded or embedded in its HTML.
//  5. Opening Analyze, Earnings and Manage → Designs in its own tab and
//     learning from the requests those pages make.
// Then it downloads your sales history (several marketplaces at once) and
// your whole catalog (big pages, several at once when the list allows it).

import { addDays } from '../shared/dates';
import {
  buildRequest,
  chunks,
  describeRequest,
  describeShape,
  isCatalogSource,
  isStrongCatalog,
  isStrongSales,
  learn,
  nextPage,
  rankTemplates,
  requestContext,
  type Capture,
  type PageState,
  type Template,
} from '../shared/learn';
import { MARKETPLACE_IDS, type MarketplaceId } from '../shared/marketplaces';
import { normalizeSales } from '../shared/sales';
import type { Settings } from '../shared/settings';
import { get, getSettings, set, update } from '../shared/storage';
import type { AccountFacts, CatalogItem, RangeTotal, SaleRow, SyncDebug, SyncMode, SyncState } from '../shared/types';
import { zonedDay, zonedToEpoch } from '../shared/zoned';
import { pageFetch, pageInfo, pageScan, type PageInfo, type Wire, type WireResult } from './page';

export interface SyncHooks {
  ingestSales(rows: SaleRow[]): Promise<unknown>;
  ingestTotals(totals: RangeTotal[]): Promise<unknown>;
  ingestCatalog(items: CatalogItem[]): Promise<unknown>;
  catalogComplete(startedAt: number): Promise<unknown>;
  mergeAccount(account: AccountFacts): Promise<unknown>;
  saveTemplate(template: Template): Promise<unknown>;
  refreshBadge(): Promise<unknown>;
}

let hooks: SyncHooks | null = null;
export function configureSync(h: SyncHooks) {
  hooks = h;
}

export const MERCH = 'https://merch.amazon.com';
const SALES_PAGES = ['/analyze', '/analyze/earnings', '/analyze/sales', '/dashboard?oldDash='];
const CATALOG_PAGES = ['/manage/designs', '/manage/products', '/manage'];
const STALL_MS = 150_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class SignInError extends Error {}
class StopError extends Error {}
class TabError extends Error {}

interface Run {
  id: number;
  mode: SyncMode;
  interactive: boolean;
  tabId: number;
  ownTab: boolean;
  stop: boolean;
  requests: number;
  errors: number;
  signinHits: number;
  okHits: number;
  debug: SyncDebug;
  scanned: Set<string>;
  refetched: Set<string>;
  shapesLogged: number;
  settings: Settings;
}

let active: Run | null = null;
let runCounter = 0;

export function syncActive(): boolean {
  return active !== null;
}

// ---------- state and log ----------

let stateChain: Promise<unknown> = Promise.resolve();
function writeState(run: Run, fn: (s: SyncState) => SyncState): Promise<void> {
  const next = stateChain.then(async () => {
    if (active !== run) return;
    await update('syncState', (s) => ({ ...fn(s), updatedAt: Date.now() }));
  });
  stateChain = next.catch(() => undefined);
  return next;
}

const clock = () => new Date().toTimeString().slice(0, 8);

function check(run: Run) {
  if (run.stop || active !== run) throw new StopError('Stopped.');
}

async function note(run: Run, phase: string, extra: Partial<SyncState> = {}) {
  check(run);
  await writeState(run, (s) => ({ ...s, ...extra, phase, log: [...(s.log ?? []), `${clock()} ${phase}`].slice(-80) }));
}

async function detail(run: Run, line: string) {
  await writeState(run, (s) => ({ ...s, log: [...(s.log ?? []), `${clock()}   ${line}`].slice(-80) }));
}

async function progress(run: Run, phase: string, done: number, total: number) {
  check(run);
  await writeState(run, (s) => ({ ...s, phase, progress: { done, total } }));
}

// ---------- the tab ----------

function isSignInUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (/\/ap\/(?:signin|mfa|cvf|challenge)/.test(u.pathname)) return true;
    return u.origin === MERCH && /^\/(?:sign-?in|login|landing)\b/i.test(u.pathname);
  } catch {
    return false;
  }
}

async function findMerchTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: `${MERCH}/*` }).catch(() => [] as chrome.tabs.Tab[]);
  return tabs.find((t) => t.id !== undefined && !t.discarded && t.status === 'complete' && !isSignInUrl(t.url ?? ''));
}

/** Waits for the tab to settle on a Merch page. Amazon bounces through sign-in even when you're signed in, so only a tab that stays there needs you. */
async function waitReady(tabId: number, timeoutMs = 35_000): Promise<'ready' | 'signin'> {
  const started = Date.now();
  let signinSince = 0;
  let lastUrl = '';
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) throw new TabError('The Merch tab was closed.');
    const url = tab.url || tab.pendingUrl || '';
    lastUrl = url;
    if (isSignInUrl(url)) {
      signinSince ||= Date.now();
      if (Date.now() - signinSince > 9_000) return 'signin';
    } else {
      signinSince = 0;
      if (url.startsWith(MERCH) && tab.status === 'complete') return 'ready';
    }
    await sleep(300);
  }
  if (lastUrl.startsWith(MERCH) && !isSignInUrl(lastUrl)) return 'ready';
  if (isSignInUrl(lastUrl)) return 'signin';
  throw new TabError(`Merch didn't load within ${Math.round(timeoutMs / 1000)} seconds.`);
}

/** After asking a tab to load something, waits (briefly) until it actually starts loading. */
async function navigationStarted(tabId: number, path?: string) {
  const started = Date.now();
  while (Date.now() - started < 3_000) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || tab.status !== 'complete' || (path && (tab.url ?? '').includes(path))) return;
    await sleep(100);
  }
}

async function openOwnTab(run: Run, path = '/dashboard'): Promise<void> {
  const tab = await chrome.tabs.create({ url: `${MERCH}${path}`, active: false });
  run.tabId = tab.id!;
  run.ownTab = true;
  await writeState(run, (s) => ({ ...s, tabId: run.tabId, openedTab: true }));
  if ((await waitReady(run.tabId)) === 'signin') throw new SignInError('Merch on Demand needs you to sign in.');
}

async function navigate(run: Run, path: string): Promise<string> {
  if (!run.ownTab) await openOwnTab(run, path);
  else {
    await chrome.tabs.update(run.tabId, { url: `${MERCH}${path}` }).catch(() => {
      throw new TabError('The Merch tab was closed.');
    });
    await navigationStarted(run.tabId, path.split('?')[0]);
    if ((await waitReady(run.tabId)) === 'signin') throw new SignInError('Merch on Demand needs you to sign in.');
  }
  const tab = await chrome.tabs.get(run.tabId).catch(() => null);
  return tab?.url ?? '';
}

/** Runs a function in the Merch tab's page world. If the tab went away, moves to a tab of Loupe's own once. */
async function inTab<A extends unknown[], R>(run: Run, func: (...args: A) => R | Promise<R>, args: A, timeoutMs: number): Promise<R> {
  for (let attempt = 0; attempt < 2; attempt++) {
    check(run);
    try {
      const call = chrome.scripting.executeScript({ target: { tabId: run.tabId }, world: 'MAIN', func, args } as never) as Promise<Array<{ result?: R }>>;
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new TabError('The Merch tab stopped responding.')), timeoutMs));
      const [first] = await Promise.race([call, timeout]);
      if (first && first.result !== undefined && first.result !== null) return first.result;
      throw new TabError('The Merch page navigated away mid-request.');
    } catch (error) {
      if (error instanceof StopError || error instanceof SignInError) throw error;
      if (attempt === 1) throw error instanceof TabError ? error : new TabError(`Couldn't run in the Merch tab: ${(error as Error).message}`);
      await detail(run, `tab problem: ${(error as Error).message}; recovering`);
      const tab = await chrome.tabs.get(run.tabId).catch(() => null);
      if (tab?.url?.startsWith(MERCH) && !isSignInUrl(tab.url)) {
        // An error page or a half-loaded page: reload Loupe's own tab; wait for yours.
        if (run.ownTab) {
          await chrome.tabs.reload(run.tabId).catch(() => undefined);
          await navigationStarted(run.tabId);
        }
        if ((await waitReady(run.tabId)) === 'signin') throw new SignInError('Merch on Demand needs you to sign in.');
      } else if (tab && isSignInUrl(tab.url ?? '')) {
        if ((await waitReady(run.tabId)) === 'signin') throw new SignInError('Merch on Demand needs you to sign in.');
      } else {
        await openOwnTab(run);
      }
    }
  }
  throw new TabError('The Merch tab stopped responding.');
}

// ---------- requests ----------

interface Done { wire: Wire; res: WireResult; capture: Capture | null }

function wireOf(t: Template, opts: Parameters<typeof buildRequest>[1]): Wire {
  const b = buildRequest(t, opts);
  // Send the page's current anti-forgery tokens, as Merch's own requests do.
  return { url: b.url, method: b.method, headers: b.headers, body: b.body, addTokens: true };
}

function toCapture(wire: Wire, res: WireResult): Capture | null {
  if (!res.text || res.status < 200 || res.status >= 400) return null;
  const text = res.text.replace(/^\)\]\}',?\s*/, '').trimStart();
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    return { url: wire.url, method: wire.method, status: res.status, headers: wire.headers, body: wire.body, payload: JSON.parse(text), at: Date.now() };
  } catch {
    return null;
  }
}

/** Executes requests in the tab (with a worker pool), retrying timeouts and throttling once. */
async function exec(run: Run, wires: Wire[], opts: { concurrency?: number; timeoutMs?: number; strictAuth?: boolean } = {}): Promise<Done[]> {
  if (!wires.length) return [];
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const concurrency = opts.concurrency ?? 4;
  const budget = timeoutMs * Math.ceil(wires.length / concurrency) + 20_000;
  let results = await inTab(run, pageFetch, [wires, timeoutMs, concurrency], budget);
  run.requests += wires.length;
  const retry = results.map((r, i) => (r.status === 0 || r.status === 429 || r.status >= 500 ? i : -1)).filter((i) => i >= 0);
  if (retry.length) {
    await sleep(2500);
    const again = await inTab(run, pageFetch, [retry.map((i) => wires[i]!), timeoutMs, concurrency], budget);
    run.requests += retry.length;
    results = results.slice();
    retry.forEach((i, k) => (results[i] = again[k]!));
  }
  const out = wires.map((wire, i) => {
    const res = results[i]!;
    const signin = res.status === 401 || isSignInUrl(res.finalUrl);
    if (signin) run.signinHits += 1;
    else if (res.status >= 200 && res.status < 400) run.okHits += 1;
    if (!res.status || res.status >= 400 || signin) run.errors += 1;
    return { wire, res, capture: signin ? null : toCapture(wire, res) };
  });
  if (opts.strictAuth && out.length && out.every((d) => d.res.status === 401 || isSignInUrl(d.res.finalUrl))) {
    throw new SignInError('Merch on Demand needs you to sign in.');
  }
  return out;
}

async function ingest(c: Capture, saveTemplate = true): Promise<{ rows: number; items: number; totals: number; template: Template | null }> {
  const l = learn(c);
  const h = hooks!;
  if (l.account) await h.mergeAccount(l.account);
  if (l.rows.length) await h.ingestSales(l.rows.map((r) => ({ ...r, source: 'capture' as const })));
  if (l.items.length) await h.ingestCatalog(l.items);
  if (saveTemplate && l.template) await h.saveTemplate(l.template);
  return { rows: l.rows.length, items: l.items.length, totals: l.totals, template: l.template };
}

async function templates(): Promise<{ sales: Template | null; catalog: Template | null }> {
  const list = await get('templates');
  return {
    sales: rankTemplates(list.filter((t) => t.kind === 'sales'))[0] ?? null,
    catalog: rankTemplates(list.filter((t) => isCatalogSource(t)))[0] ?? null,
  };
}

// ---------- discovery ----------

function pacific(day: string, end = false): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return end ? zonedToEpoch(y, m, d, 23, 59, 59, 999) : zonedToEpoch(y, m, d);
}

const DESTRUCTIVE = /delete|remove|update|publish|create|submit|save|upload|edit|cancel|archive|patch|duplicate|clone|send|write|modify|logout|sign-?out|download|export|generate|trigger|reset|dismiss|ack\b|mark|subscribe|opt-?out|\/new\b/i;
const SALESISH = /report|sale|purchase|royalt|earning|analy|order|revenue/i;
const CATALOGISH = /merchandise|product|design|listing|catalog|asin/i;
const ACCOUNTISH = /account|summary|tier|dashboard|limit/i;
const US_MID = 'ATVPDKIKX0DER';

/** Endpoints Merch on Demand has served sales, products and account data from. Each is verified by what it returns. */
function knownProbes(today: string): Wire[] {
  const from = addDays(today, -29);
  const ms = `fromDate=${pacific(from)}&toDate=${pacific(today, true)}`;
  const paths = [
    `/api/reporting/purchases/records?marketplaceId=${US_MID}&${ms}`,
    `/api/reporting/purchases/report?marketplaceId=${US_MID}&${ms}`,
    `/api/reporting/purchases/summary?marketplaceId=${US_MID}&${ms}`,
    `/merchandise/all?pageSize=100&pageNumber=1`,
    `/merchandise/list?pageSize=100&pageNumber=1`,
    `/api/merchandise/list?pageSize=100&pageNumber=1`,
    `/api/ratelimiter/metadata`,
    `/accountSummary`,
    `/api/account/summary`,
  ];
  return paths.map((p) => probeWire(`${MERCH}${p}`));
}

function probeWire(url: string): Wire {
  return { url, method: 'GET', headers: { accept: 'application/json, text/plain, */*' }, addTokens: true };
}

/** Requests worth trying for an API path found in Merch's scripts. */
function probesForPath(path: string, today: string): Wire[] {
  if (/[{}$]|\/:[a-z]/i.test(path) || DESTRUCTIVE.test(path)) return [];
  let url: URL;
  try {
    url = new URL(path, MERCH);
  } catch {
    return [];
  }
  if (!/amazon\.|a2z\./.test(url.hostname)) return [];
  const base = url.href.replace(/\/$/, '');
  const from = addDays(today, -29);
  if (SALESISH.test(path)) {
    return [
      `${base}?marketplaceId=${US_MID}&fromDate=${pacific(from)}&toDate=${pacific(today, true)}`,
      `${base}?marketplaceId=${US_MID}&startDate=${from}&endDate=${today}`,
      `${base}?fromDate=${from}&toDate=${today}`,
    ].map(probeWire);
  }
  if (CATALOGISH.test(path) && !/image|asset|upload|template|mockup|preview/i.test(path)) {
    return [`${base}?pageSize=100&pageNumber=1`, base].map(probeWire);
  }
  if (ACCOUNTISH.test(path)) return [probeWire(base)];
  return [];
}

/** One line describing a response's structure (field names and value kinds only), for the sync log. */
function shapeLine(payload: unknown): string {
  return describeShape(payload, 14).join(' · ').slice(0, 600);
}

async function recordProbes(run: Run, done: Done[], label: string): Promise<{ sales: number; catalog: number }> {
  let sales = 0;
  let catalog = 0;
  for (const d of done) {
    let kind = d.res.error ? d.res.error : 'not-json';
    let rows = 0;
    let items = 0;
    let keys: string[] | undefined;
    if (d.capture) {
      const r = await ingest(d.capture);
      rows = r.rows;
      items = r.items;
      const t = r.template;
      kind = t ? `${t.kind}${t.rows ? '' : ' (empty)'}${t.kind === 'sales' && t.rows && !t.dated ? ' (range totals)' : ''}` : rows ? 'sales (no template)' : items ? 'catalog (no template)' : 'none';
      if (t?.kind === 'sales' && t.rows > 0) sales += 1;
      if (t?.kind === 'catalog') catalog += 1;
      keys = describeShape(d.capture.payload, 14);
      // A sales report Loupe can't read yet: put its structure in the log.
      if (t?.kind === 'sales' && !t.rows && run.shapesLogged < 4) {
        run.shapesLogged += 1;
        await detail(run, `unreadable report ${new URL(d.wire.url).pathname}: ${shapeLine(d.capture.payload)}`);
      }
    }
    run.debug.probes.push({ request: `${label} ${describeRequest(d.wire.method, d.wire.url, d.wire.body)}`, status: d.res.status, kind, rows, items, ms: d.res.ms, keys });
  }
  run.debug.probes = run.debug.probes.slice(-150);
  return { sales, catalog };
}

/** Data embedded in the page's HTML, and data requests the page made that Loupe didn't see. */
async function harvestPage(run: Run, info: PageInfo): Promise<{ embedded: number; refetched: number }> {
  let embedded = 0;
  for (const e of info.embedded) {
    try {
      const payload = JSON.parse(e.text) as unknown;
      const r = await ingest({ url: info.url, method: 'EMBED', status: 200, headers: {}, payload, at: Date.now() }, false);
      if (r.rows || r.items) embedded += 1;
    } catch {
      /* not JSON */
    }
  }
  const known = new Set((await get('templates')).map((t) => t.url.split('?')[0]));
  const urls = info.requests.filter((u) => {
    try {
      const p = new URL(u);
      if (p.protocol !== 'https:' || /\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ico|map|html?)$/i.test(p.pathname)) return false;
      if (/^(?:fls-|unagi|aax|aan\.|metrics|csm|rum|dataplane)/i.test(p.hostname) || !/amazon\.|a2z\./.test(p.hostname)) return false;
      const key = p.origin + p.pathname;
      return !run.refetched.has(u) && !known.has(key) && !DESTRUCTIVE.test(p.pathname) && (SALESISH.test(p.pathname) || CATALOGISH.test(p.pathname) || ACCOUNTISH.test(p.pathname));
    } catch {
      return false;
    }
  });
  for (const u of info.requests) {
    try {
      const p = new URL(u);
      run.debug.resources.push(`${p.host}${p.pathname}${p.search ? `?${Array.from(p.searchParams.keys()).join(',')}` : ''}`);
    } catch {
      /* skip */
    }
  }
  run.debug.resources = Array.from(new Set(run.debug.resources)).slice(-120);
  const pick = urls.slice(0, 16);
  pick.forEach((u) => run.refetched.add(u));
  if (pick.length) await recordProbes(run, await exec(run, pick.map(probeWire), { concurrency: 6, timeoutMs: 20_000 }), 'page-request');
  return { embedded, refetched: pick.length };
}

const LITERAL = /["'`]((?:https:\/\/[a-z0-9.-]+)?\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_${}:.-]+)+\/?)(?:\?[^"'`\s]{0,200})?["'`]/g;
const API_WORD = /api|report|sale|purchase|royalt|earning|analy|merchandise|product|design|listing|catalog|account|summary|graphql|search|dashboard|tier/i;
const STATIC = /\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ico|map|html?)$/i;

/** Scripts the page couldn't read (another host without CORS) are fetched by the extension itself. */
async function scanFromWorker(urls: string[]): Promise<{ paths: string[]; read: number }> {
  const found = new Set<string>();
  let read = 0;
  await pool(urls, 6, async (url) => {
    try {
      const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return;
      const text = await res.text();
      read += 1;
      if (text.length > 15_000_000) return;
      for (const m of text.matchAll(LITERAL)) {
        const path = m[1]!;
        if (path.length > 160 || STATIC.test(path) || !API_WORD.test(path)) continue;
        if (/^https:\/\//.test(path) && !/amazon|a2z/.test(path)) continue;
        found.add(path);
      }
    } catch {
      /* not allowed or not reachable */
    }
  });
  return { paths: Array.from(found), read };
}

/** Reads the page's scripts for API paths and probes the promising ones. */
async function scanScripts(run: Run, info: PageInfo, today: string) {
  const fresh = info.scripts.filter((s) => !run.scanned.has(s) && /^https:\/\//.test(s) && /amazon|a2z/.test(new URL(s).hostname));
  if (!fresh.length) return;
  fresh.forEach((s) => run.scanned.add(s));
  const scan = await inTab(run, pageScan, [fresh.slice(0, 60), 20_000], 90_000);
  if (scan.failedUrls.length) {
    const more = await scanFromWorker(scan.failedUrls);
    scan.paths = Array.from(new Set([...scan.paths, ...more.paths]));
    scan.read += more.read;
    scan.failed -= more.read;
  }
  run.debug.discovered = Array.from(new Set([...run.debug.discovered, ...scan.paths])).slice(0, 400);
  await detail(run, `read ${scan.read} Merch scripts (${scan.failed} unreadable), found ${scan.paths.length} API paths`);
  const tried = new Set(run.debug.probes.map((p) => p.request));
  const wires = scan.paths
    .flatMap((p) => probesForPath(p, today))
    .filter((w) => !tried.has(`script-path ${describeRequest(w.method, w.url)}`))
    .slice(0, 48);
  if (wires.length) {
    const r = await recordProbes(run, await exec(run, wires, { concurrency: 6, timeoutMs: 20_000 }), 'script-path');
    await detail(run, `tried ${wires.length} of them: ${r.sales} sales, ${r.catalog} product sources`);
  }
}

/** Waits for the page to load its data (captured by the content script), up to `max` ms. */
async function waitForCaptures(run: Run, need: () => Promise<{ sales: boolean; catalog: boolean }>, since: number, max = 15_000): Promise<number> {
  const started = Date.now();
  let last = 0;
  let seen = 0;
  while (Date.now() - started < max) {
    check(run);
    const n = await need();
    if (!n.sales && !n.catalog) break;
    // An empty sales report just arrived: verify it now rather than wait.
    const t = (await templates()).sales;
    if (n.sales && t && t.rows === 0 && t.window && t.capturedAt >= since) break;
    const fresh = (await get('captureLog')).filter((e) => e.at >= since).length;
    if (fresh > seen) {
      seen = fresh;
      last = Date.now();
    }
    const elapsed = Date.now() - started;
    // Nothing at all after 5 s: this page doesn't load data by itself.
    if (!seen && elapsed > 5_000) break;
    // Data came in and has been quiet for 2.5 s.
    if (last && Date.now() - last > 2_500 && elapsed > 3_500) break;
    await sleep(400);
  }
  return seen;
}

// ---------- sales ----------

/** Runs one sales request and follows its pages. */
async function salesRange(run: Run, t: Template, opts: { from?: string; to?: string; marketplace?: MarketplaceId }, split = true): Promise<Capture[]> {
  const [first] = await exec(run, [wireOf(t, opts)], { strictAuth: true });
  if (!first?.capture) {
    // Some reports reject long ranges: retry a week at a time (daily rows only; totals must stay whole).
    if (split && t.dated && opts.from && opts.to && opts.from !== opts.to && first && first.res.status >= 400 && first.res.status !== 401) {
      const weeks = chunks(opts.from, opts.to, 7);
      if (weeks.length < 2) return [];
      const done = await exec(run, weeks.map((w) => wireOf(t, { ...opts, from: w.from, to: w.to })), { strictAuth: true });
      return done.map((d) => d.capture).filter((c): c is Capture => c !== null);
    }
    return [];
  }
  const pages = [first.capture];
  if (!t.pages.length && !t.tokenKey) return pages;
  const seen = new Set(learn(first.capture).rows.map((r) => `${r.date}|${r.marketplace}|${r.asin}`));
  let state: PageState = {};
  let current = first.capture;
  for (let i = 0; i < 60; i++) {
    const next = nextPage(t, state, current.payload, learn(current).rows.length, seen.size);
    if (!next) break;
    state = next;
    const [d] = await exec(run, [wireOf(t, { ...opts, page: state })], { strictAuth: true });
    if (!d?.capture) break;
    const before = seen.size;
    for (const r of learn(d.capture).rows) seen.add(`${r.date}|${r.marketplace}|${r.asin}`);
    if (seen.size === before) break;
    pages.push(d.capture);
    current = d.capture;
  }
  return pages;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  }));
}

async function ingestTotals(c: Capture, days: number, to: string): Promise<number> {
  // Window totals carry no per-day dates; file them under the window's last day.
  const { rows } = normalizeSales(c.payload, c.url, { ...requestContext(c), date: to, dateSource: 'url' });
  if (!rows.length) return 0;
  const byProduct = new Map<string, RangeTotal>();
  for (const r of rows) {
    const key = `${days}|${r.marketplace}|${r.asin}`;
    const t = byProduct.get(key) ?? {
      key, days, to, marketplace: r.marketplace, asin: r.asin, title: r.title, productType: r.productType,
      units: 0, cancelled: 0, returned: 0, royalty: 0, currency: r.currency, fetchedAt: Date.now(),
    };
    t.units += r.units;
    t.cancelled += r.cancelled;
    t.returned += r.returned;
    t.royalty += r.royalty;
    byProduct.set(key, t);
  }
  await hooks!.ingestTotals(Array.from(byProduct.values()));
  return byProduct.size;
}

async function downloadSales(run: Run, t: Template): Promise<number> {
  const today = zonedDay(Date.now());
  const meta = await get('meta');
  const quick = run.mode === 'quick';
  const markets: Array<MarketplaceId | undefined> = t.markets.length && !t.allMarkets ? MARKETPLACE_IDS : [undefined];
  const historyFrom = addDays(today, -(run.settings.historyDays - 1));
  const covered = meta.coverage?.salesFrom && meta.coverage.salesFrom <= historyFrom;
  const from = quick ? addDays(today, -2) : covered ? addDays(today, -7) : historyFrom;
  let rows = 0;
  let coveredFrom = from;

  if (!t.window) {
    await note(run, 'Reading your sales report…');
    const [d] = await exec(run, [wireOf(t, {})], { strictAuth: true });
    if (d?.capture) rows += (await ingest(d.capture, false)).rows;
    coveredFrom = today;
  } else if (t.dated) {
    const ranges = chunks(from, today, quick ? 3 : 31);
    const total = markets.length * ranges.length;
    let done = 0;
    await note(run, `Downloading sales ${from} → ${today}${markets.length > 1 ? ` in ${markets.length} marketplaces` : ''}…`);
    // One worker per marketplace, newest month first; a marketplace with three
    // empty months in a row is done. Four marketplaces at a time.
    await pool(markets, 4, async (mp) => {
      let empty = 0;
      let i = 0;
      for (const range of ranges) {
        i += 1;
        if (empty >= 3) break;
        let n = 0;
        for (const c of await salesRange(run, t, { from: range.from, to: range.to, marketplace: mp })) n += (await ingest(c, false)).rows;
        rows += n;
        empty = n ? 0 : empty + 1;
        done += 1;
        await progress(run, `Downloading sales · ${range.from.slice(0, 7)}${mp ? ` · ${mp}` : ''} · ${rows.toLocaleString()} rows`, done, total);
      }
      done += ranges.length - i;
      if (mp && empty < 3 && i === ranges.length) await detail(run, `${mp}: ${ranges.length} months`);
    });
    await detail(run, `sales: ${rows.toLocaleString()} rows`);
  } else {
    // Reports of totals per product for the requested range (Merch's
    // purchases report): daily history comes from asking one day at a time,
    // product totals from 30/90/365-day ranges.
    const known = (meta.knownMarkets ?? []).filter((m): m is MarketplaceId => (MARKETPLACE_IDS as string[]).includes(m));
    let activeMarkets: Array<MarketplaceId | undefined> = [];
    if (quick && known.length) activeMarkets = markets[0] === undefined ? [undefined] : known;
    else {
      await note(run, 'Finding the marketplaces you sell in…');
      await pool(markets, 4, async (mp) => {
        let found = 0;
        for (const c of await salesRange(run, t, { from: addDays(today, -364), to: today, marketplace: mp }, false)) found += await ingestTotals(c, 365, today);
        // Merch may cap the range: 90 days still tells whether this marketplace sells.
        if (!found) for (const c of await salesRange(run, t, { from: addDays(today, -89), to: today, marketplace: mp }, false)) found += await ingestTotals(c, 90, today);
        if (found > 0) activeMarkets.push(mp);
      });
      await detail(run, `selling in ${activeMarkets.map((m) => m ?? 'all').join(', ') || 'no marketplace in the past year'}`);
    }
    // Days to read: the last week every time; a full sync also reaches 120 days
    // further back (90 on the first one) until the whole history is covered.
    const days = new Set<string>();
    const recent = quick ? 2 : 7;
    for (let i = 0; i < recent; i++) days.add(addDays(today, -i));
    if (!quick) {
      const reached = meta.coverage?.salesFrom && meta.coverage.salesFrom < addDays(today, -6) ? meta.coverage.salesFrom : null;
      const start = reached ?? addDays(today, -6);
      const target = addDays(start, -(reached ? 120 : 83));
      const stop = target < historyFrom ? historyFrom : target;
      for (let d = addDays(start, -1); d >= stop; d = addDays(d, -1)) days.add(d);
      coveredFrom = stop < start ? stop : start;
    } else coveredFrom = today;
    const dayList = Array.from(days).sort().reverse();
    const plan = activeMarkets.flatMap((mp) => [
      ...dayList.map((day) => ({ mp, from: day, to: day, window: 0 })),
      ...(quick ? [] : [30, 90].map((w) => ({ mp, from: addDays(today, -(w - 1)), to: today, window: w }))),
    ]);
    if (!quick) await note(run, `Downloading daily sales ${dayList[dayList.length - 1]} → ${today} in ${activeMarkets.length} marketplace${activeMarkets.length === 1 ? '' : 's'}…`);
    let done = 0;
    await pool(plan, 6, async (step) => {
      for (const c of await salesRange(run, t, { from: step.from, to: step.to, marketplace: step.mp }, false)) {
        if (step.window) await ingestTotals(c, step.window, today);
        else rows += (await ingest(c, false)).rows;
      }
      done += 1;
      await progress(run, step.window ? `Reading ${step.window}-day totals` : `Downloading sales · ${step.from}${step.mp ? ` · ${step.mp}` : ''} · ${rows.toLocaleString()} rows`, done, plan.length);
    });
    await detail(run, `sales: ${rows.toLocaleString()} daily rows over ${dayList.length} days`);
  }
  if (!quick) {
    await update('meta', (m) => ({
      ...m,
      coverage: { ...(m.coverage ?? {}), salesFrom: !m.coverage?.salesFrom || coveredFrom < m.coverage.salesFrom ? coveredFrom : m.coverage.salesFrom, salesTo: today },
    }));
  }
  return rows;
}

// ---------- catalog ----------

async function downloadCatalog(run: Run, template: Template): Promise<{ items: number; complete: boolean }> {
  let t = template;
  const startedAt = Date.now();
  const seen = new Set<string>();
  const sizeSlot = t.pages.find((p) => p.role === 'size');
  const pageSlot = t.pages.find((p) => p.role === 'page');
  const offsetSlot = t.pages.find((p) => p.role === 'offset');
  const take = async (c: Capture) => {
    const items = learn(c).items;
    const before = seen.size;
    for (const i of items) seen.add(i.key);
    if (items.length) await hooks!.ingestCatalog(items);
    return { got: items.length, fresh: seen.size - before };
  };

  await note(run, 'Reading your products…');
  // Start from the first page even if Merch's page was showing a later one.
  const firstPage = pageSlot ? Math.min(Number(pageSlot.value) || 0, 1) : undefined;
  const base: PageState = { page: firstPage, offset: offsetSlot ? 0 : undefined };
  // Bigger pages when the list allows it (fewer requests); fall back to smaller ones, then the original size.
  const original = sizeSlot ? Number(sizeSlot.value) : NaN;
  const sizes = Number.isFinite(original) ? [250, 100].filter((n) => n > original) : [];
  let state: PageState = base;
  let first: Done | undefined;
  for (const size of [...sizes, undefined]) {
    state = size ? { ...base, size } : base;
    [first] = await exec(run, [wireOf(t, { page: state })], { strictAuth: true });
    if (first?.capture && learn(first.capture).items.length) break;
  }
  if (!first?.capture) return { items: 0, complete: false };
  const r0 = await take(first.capture);
  let complete = false;
  let current = first.capture;
  let pageSize = r0.got;

  if ((pageSlot || offsetSlot) && !t.tokenKey && pageSize > 0) {
    // Numbered pages: four at a time until a page comes back short or empty.
    const startPage = firstPage ?? 0;
    const startOffset = 0;
    let k = 1;
    for (let batch = 0; batch < 300 && !complete; batch++) {
      const steps = [k, k + 1, k + 2, k + 3];
      k += 4;
      const done = await exec(run, steps.map((j) => wireOf(t, { page: { ...state, page: pageSlot ? startPage + j : undefined, offset: offsetSlot ? startOffset + j * pageSize : undefined } })), { strictAuth: true });
      for (const d of done) {
        if (!d.capture) {
          complete = true;
          break;
        }
        const r = await take(d.capture);
        if (r.got < pageSize || r.fresh === 0) {
          complete = true;
          break;
        }
      }
      await progress(run, `Reading your products · ${seen.size.toLocaleString()} so far`, seen.size, Math.max(seen.size, seen.size + pageSize));
    }
  } else {
    for (let i = 0; i < 1000; i++) {
      const next = nextPage(t, state, current.payload, pageSize, seen.size);
      if (!next) {
        complete = true;
        break;
      }
      state = next;
      const [d] = await exec(run, [wireOf(t, { page: state })], { strictAuth: true });
      if (!d?.capture) break;
      const r = await take(d.capture);
      if (r.fresh === 0) {
        complete = true;
        break;
      }
      pageSize = r.got;
      current = d.capture;
      await progress(run, `Reading your products · ${seen.size.toLocaleString()} so far`, seen.size, seen.size + pageSize);
    }
  }
  // Paging worked with a token the template didn't know about: remember it, so this list counts as complete next time.
  if (complete && !t.tokenKey && state.tokenName && seen.size > r0.got) {
    t = { ...t, tokenKey: state.tokenName, rows: seen.size };
    await hooks!.saveTemplate(t);
  }
  if (complete && isStrongCatalog(t)) await hooks!.catalogComplete(startedAt);
  await update('meta', (m) => ({ ...m, coverage: { ...(m.coverage ?? {}), catalogAt: Date.now() } }));
  await detail(run, `products: ${seen.size.toLocaleString()}${complete ? '' : ' (incomplete)'}`);
  return { items: seen.size, complete };
}

/** A sales request that came back empty is verified with a 30-day range before being trusted. */
async function verifySales(run: Run, t: Template): Promise<Template> {
  if (t.rows > 0 || !t.window) return t;
  const today = zonedDay(Date.now());
  const [d] = await exec(run, [wireOf(t, { from: addDays(today, -29), to: today })]);
  if (!d?.capture) return t;
  // Learn again from the fuller response: it shows whether rows carry their own dates.
  const r = await ingest(d.capture, false);
  await detail(run, `checked the empty sales report with 30 days: ${r.rows ? `${r.rows} daily rows` : r.totals ? `${r.totals} products with range totals` : '0 rows'}`);
  if (!r.rows && !r.totals && run.shapesLogged < 4) {
    run.shapesLogged += 1;
    await detail(run, `unreadable report ${new URL(d.wire.url).pathname}: ${shapeLine(d.capture.payload)}`);
  }
  if (r.template?.kind === 'sales' && r.template.rows > 0) {
    const verified = { ...r.template, id: t.id, headers: t.headers };
    await hooks!.saveTemplate(verified);
    return verified;
  }
  return t;
}

// ---------- the run ----------

export async function startSync(
  mode: SyncMode,
  interactive: boolean,
  preferTab?: number,
  opts: { restarts?: number; ownTab?: boolean } = {},
): Promise<Record<string, unknown>> {
  if (active) return { running: true };
  const settings = await getSettings();
  const restarts = opts.restarts ?? 0;
  let tabId = preferTab;
  const ownTab = preferTab !== undefined && opts.ownTab === true;
  if (tabId === undefined) tabId = (await findMerchTab())?.id;
  if (tabId === undefined) {
    if (!interactive && !settings.backgroundTabSync) {
      await update('syncState', (s) => ({ ...s, status: 'idle', phase: 'Open Merch on Demand to sync.' }));
      return { needsTab: true };
    }
  }
  const run: Run = {
    id: ++runCounter, mode, interactive, tabId: tabId ?? -1, ownTab, stop: false, requests: 0, errors: 0, signinHits: 0, okHits: 0,
    debug: { at: Date.now(), probes: [], discovered: [], resources: [], pages: [] }, scanned: new Set(), refetched: new Set(), shapesLogged: 0, settings,
  };
  active = run;
  await set('syncState', { status: 'running', mode, phase: 'Starting…', startedAt: Date.now(), updatedAt: Date.now(), tabId, openedTab: ownTab, log: [], restarts });
  await chrome.alarms.create('syncwatch', { periodInMinutes: 0.5 });
  void execute(run);
  return { started: true };
}

export async function stopSync() {
  if (active) {
    active.stop = true;
    return;
  }
  // Nothing is running in this worker: a "running" state is left over (an older version, a crash).
  const s = await get('syncState');
  if (s.status === 'running') await set('syncState', { ...s, status: 'idle', phase: 'Stopped.', progress: undefined, finishedAt: Date.now() });
}

/** Called every 30 s while a sync runs: restarts a run the browser killed, ends one that hangs. */
export async function watchdog() {
  const s = await get('syncState');
  if (s.status !== 'running') {
    if (!active) await chrome.alarms.clear('syncwatch');
    return;
  }
  const silent = Date.now() - (s.updatedAt ?? s.startedAt ?? 0);
  if (!active) {
    // The service worker was restarted mid-run: pick up where the data left off.
    if ((s.restarts ?? 0) < 2) await startSync(s.mode === 'connect' ? 'full' : s.mode, false, undefined, { restarts: (s.restarts ?? 0) + 1 });
    else await set('syncState', { ...s, status: 'error', phase: 'The sync was interrupted.', error: 'The browser stopped Loupe’s background worker twice. Sync again.', finishedAt: Date.now() });
    return;
  }
  if (silent > STALL_MS) {
    const run = active;
    run.stop = true;
    active = null;
    await set('syncState', { ...s, status: 'error', phase: `Sync stalled at: ${s.phase}`, error: 'No progress for over two minutes. Sync again; if it repeats, copy the sync report.', finishedAt: Date.now() });
    await finish(run, true);
  }
}

async function finish(run: Run, failed: boolean) {
  await chrome.alarms.clear('syncwatch');
  // A routine sync that didn't need to look for anything keeps the last discovery's details.
  const prev = await get('syncDebug');
  if (run.debug.probes.length || run.debug.pages.length || !prev) await set('syncDebug', run.debug);
  if (!failed) await update('meta', (m) => ({ ...m, lastCaptureAt: Date.now() }));
  await hooks!.refreshBadge();
  const s = await get('syncState');
  if (run.ownTab && s.status !== 'signin' && run.tabId >= 0) {
    const tab = await chrome.tabs.get(run.tabId).catch(() => null);
    if (tab && !tab.active) await chrome.tabs.remove(run.tabId).catch(() => undefined);
  }
}

async function execute(run: Run) {
  let salesRows = 0;
  let catalogItems = 0;
  let failed = false;
  const stats = () => ({ salesRows, catalogItems, requests: run.requests, errors: run.errors });
  try {
    // 0. A Merch tab to work in.
    if (run.tabId < 0) {
      await note(run, 'Opening Merch on Demand in a background tab…');
      await openOwnTab(run);
    } else {
      await note(run, 'Using your open Merch on Demand tab…');
      if ((await waitReady(run.tabId)) === 'signin') throw new SignInError('Merch on Demand needs you to sign in.');
    }
    const today = zonedDay(Date.now());
    let have = await templates();
    const needs = async () => {
      have = await templates();
      return { sales: !isStrongSales(have.sales), catalog: run.mode !== 'quick' && !isStrongCatalog(have.catalog) };
    };

    // 1. Verify what Loupe already knows, and try the known endpoints, in one go.
    let n = await needs();
    if (n.sales || n.catalog || run.mode === 'connect') {
      await note(run, 'Looking for your sales and products…');
      const info = await inTab(run, pageInfo, [], 20_000);
      if (info.signin) throw new SignInError('Merch on Demand needs you to sign in.');
      const known = await exec(run, knownProbes(today), { concurrency: 8, timeoutMs: 20_000 });
      const r = await recordProbes(run, known, 'known');
      await detail(run, `known endpoints: ${r.sales} sales, ${r.catalog} product sources`);
      const h = await harvestPage(run, info);
      if (h.embedded || h.refetched) await detail(run, `this page: ${h.embedded} embedded data blocks, ${h.refetched} data requests re-read`);
      if (have.sales && !isStrongSales(have.sales)) have.sales = await verifySales(run, have.sales);
      n = await needs();

      // 2. API paths in Merch's own scripts.
      if (n.sales || n.catalog) {
        await note(run, 'Reading Merch’s scripts for its data endpoints…');
        await scanScripts(run, info, today);
        n = await needs();
      }

      // 3. Open the pages that load sales and products, in Loupe's own tab.
      const queue = [...(n.sales ? SALES_PAGES : []), ...(n.catalog ? CATALOG_PAGES : [])];
      for (const path of queue) {
        n = await needs();
        if (!n.sales && !n.catalog) break;
        if (SALES_PAGES.includes(path) && !n.sales) continue;
        if (CATALOG_PAGES.includes(path) && !n.catalog) continue;
        await note(run, `Opening ${path.split('?')[0]} to learn how it loads your ${SALES_PAGES.includes(path) ? 'sales' : 'products'}…`);
        const since = Date.now();
        const landed = await navigate(run, path);
        const captures = await waitForCaptures(run, needs, since);
        const page = await inTab(run, pageInfo, [], 20_000);
        const h2 = await harvestPage(run, page);
        run.debug.pages.push({ url: path, landed: (() => { try { return new URL(landed).pathname; } catch { return landed; } })(), captures, embedded: h2.embedded });
        n = await needs();
        if (n.sales || n.catalog) await scanScripts(run, page, today);
        have = await templates();
        if (have.sales && !isStrongSales(have.sales)) have.sales = await verifySales(run, have.sales);
        await detail(run, `${path}: ${captures} responses learned${h2.embedded ? `, ${h2.embedded} embedded` : ''}`);
      }

    }

    have = await templates();
    if (!have.sales && !have.catalog) {
      if (run.okHits === 0 && run.signinHits > 0) throw new SignInError('Merch on Demand needs you to sign in.');
      throw new Error('Loupe could not find your sales or products on Merch. Copy the sync report (Settings → Sync diagnostics) and send it to the developer: it lists the endpoints Merch’s pages use, without any of your data.');
    }

    // 5. Download.
    // Only a sales request that has returned sales is worth a full backfill.
    if (isStrongSales(have.sales)) salesRows = await downloadSales(run, have.sales!);
    if (have.catalog && run.mode !== 'quick') catalogItems = (await downloadCatalog(run, have.catalog)).items;

    const salesOk = isStrongSales(have.sales) || salesRows > 0;
    const catalogOk = run.mode === 'quick' || isStrongCatalog(have.catalog);
    const phase = salesOk
      ? catalogOk
        ? 'Synced'
        : have.catalog
          ? 'Sales synced. Loupe read only part of your product list.'
          : 'Sales synced. Loupe has not found your product list yet.'
      : have.catalog
        ? have.sales
          ? 'Products synced. Merch answered with sales reports Loupe can’t read yet: copy the sync report and send it.'
          : 'Products synced, but Loupe has not found your sales report yet. Open Analyze on Merch once and Loupe syncs by itself.'
        : 'Synced';
    await writeState(run, (s) => ({
      ...s,
      status: salesOk && catalogOk ? 'done' : 'partial',
      phase,
      progress: undefined,
      finishedAt: Date.now(),
      stats: stats(),
      log: [...(s.log ?? []), `${clock()} ${phase} · ${salesRows.toLocaleString()} sales rows, ${catalogItems.toLocaleString()} products, ${run.requests} requests in ${Math.round((Date.now() - (s.startedAt ?? Date.now())) / 1000)} s`].slice(-80),
    }));
  } catch (error) {
    failed = true;
    const stopped = error instanceof StopError;
    const signin = error instanceof SignInError;
    // A run the watchdog already ended writes nothing (writeState checks).
    if (active === run) {
      await writeState(run, (s) => ({
        ...s,
        status: stopped ? 'idle' : signin ? 'signin' : 'error',
        phase: stopped ? 'Stopped.' : signin ? 'Sign in to Merch on Demand, then sync again.' : 'Sync stopped.',
        error: stopped ? undefined : (error as Error).message,
        progress: undefined,
        finishedAt: Date.now(),
        stats: stats(),
        log: [...(s.log ?? []), `${clock()} ${stopped ? 'Stopped' : `Error: ${(error as Error).message}`}`].slice(-80),
      }));
      if (signin && run.tabId >= 0) {
        if (run.interactive || run.ownTab) await chrome.tabs.update(run.tabId, { active: true }).catch(() => undefined);
        if (!run.interactive) {
          chrome.notifications.create('signin', {
            type: 'basic', iconUrl: 'icons/icon128.png', title: 'Loupe needs you to sign in',
            message: 'Merch on Demand signed you out. Sign in and Loupe will sync by itself.', priority: 1,
          });
        }
      }
    }
  } finally {
    if (active === run) {
      await stateChain;
      active = null;
      await finish(run, failed);
    }
  }
}

/** After you sign in, in the tab Loupe pointed you to, the sync continues by itself. */
export async function onTabUpdated(tabId: number, change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) {
  if (change.status !== 'complete' || active || !tab.url?.startsWith(MERCH) || isSignInUrl(tab.url)) return;
  const s = await get('syncState');
  if (s.status === 'signin' && s.tabId === tabId && Date.now() - (s.finishedAt ?? 0) < 30 * 60_000) {
    await startSync(s.mode, true, tabId, { ownTab: s.openedTab === true });
  }
}
