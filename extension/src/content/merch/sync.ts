// Runs a sync inside a merch.amazon.com tab, where every request carries your
// signed-in session exactly as Merch's own pages do.
//
// 1. Discover: if Loupe hasn't yet learned how this account's sales report
//    and product list are requested, it opens those pages (via the site's own
//    navigation links) and learns from the requests they make.
// 2. Fetch: it replays the learned requests for every day range, marketplace
//    and page it needs, and sends the results to the background worker.

import { addDays } from '../../shared/dates';
import { buildRequest, chunks, learn, nextPage, rankTemplates, requestContext, type Capture, type PageState, type Template } from '../../shared/learn';
import { normalizeSales } from '../../shared/sales';
import { MARKETPLACE_IDS, type MarketplaceId } from '../../shared/marketplaces';
import type { Message } from '../../shared/messages';
import { get, getSettings, update } from '../../shared/storage';
import type { RangeTotal, SaleRow, SyncMode, SyncState } from '../../shared/types';
import { zonedDay } from '../../shared/zoned';

/** Anti-forgery headers seen on this page, newest wins; merged into replays. */
export const freshHeaders: Record<string, string> = {};

export function rememberHeaders(headers: Record<string, string>) {
  for (const [k, v] of Object.entries(headers)) if (/csrf|xsrf|token|auth|a2z|session/i.test(k)) freshHeaders[k] = v;
}

const send = <T = unknown>(m: Message) => chrome.runtime.sendMessage(m) as Promise<T>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let pace = 450;
/** Polite spacing between requests, randomized around the configured pace. */
const jitter = () => sleep(pace * (0.5 + Math.random()));

async function report(patch: Partial<SyncState>) {
  await update('syncState', (s) => ({ ...s, ...patch }));
}

// ---------- discovery ----------

const SALES_LINK = /analy[sz]|sales|royalt|report|earning/i;
const CATALOG_LINK = /manage|products|designs|listings|catalog/i;
const AVOID_LINK = /create|new|upload|delete|remove|sign.?out|logout|help|resources|account|advertis|settings/i;

export function candidateLinks(doc: Document, need: { sales: boolean; catalog: boolean }): string[] {
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((a) => ({ href: a.href, text: `${a.textContent ?? ''} ${a.getAttribute('aria-label') ?? ''}`.trim(), path: (() => { try { return new URL(a.href).pathname; } catch { return ''; } })() }))
    .filter((l) => l.href.startsWith(location.origin) && l.path && l.path !== '/' && !AVOID_LINK.test(`${l.text} ${l.path}`));
  const pick = (re: RegExp) => links.filter((l) => re.test(l.text) || re.test(l.path)).map((l) => l.href.split('#')[0]!);
  const out: string[] = [];
  if (need.sales) out.push(...pick(SALES_LINK), `${location.origin}/analyze`);
  if (need.catalog) out.push(...pick(CATALOG_LINK), `${location.origin}/manage/products`, `${location.origin}/manage`);
  return Array.from(new Set(out));
}

/**
 * Waits for this page to reveal the templates still needed: until all are
 * learned, or a couple of seconds after the page's last useful response, or
 * `max` ms. Checks storage too, since the page may have loaded its data
 * before the runner started listening.
 */
async function waitForTemplates(need: { sales: boolean; catalog: boolean }, max: number, settle = 2500): Promise<void> {
  const started = Date.now();
  let lastFound = 0;
  let found = 0;
  while (Date.now() - started < max) {
    const have = await templates();
    const missing = (need.sales && !have.sales ? 1 : 0) + (need.catalog && !have.catalog ? 1 : 0);
    const now = (need.sales && have.sales ? 1 : 0) + (need.catalog && have.catalog ? 1 : 0);
    if (!missing) return;
    if (now > found) {
      found = now;
      lastFound = Date.now();
    }
    if (lastFound && Date.now() - lastFound > settle) return;
    await sleep(400);
  }
}

async function templates(): Promise<{ sales: Template | null; catalog: Template | null }> {
  const list = await get('templates');
  return {
    sales: rankTemplates(list.filter((t) => t.kind === 'sales'))[0] ?? null,
    catalog: rankTemplates(list.filter((t) => t.kind === 'catalog'))[0] ?? null,
  };
}

// ---------- requests ----------

class AuthError extends Error {}

let requestCount = 0;
let errorCount = 0;

async function execute(t: Template, opts: Parameters<typeof buildRequest>[1]): Promise<Capture | null> {
  const req = buildRequest(t, opts);
  const headers = { ...req.headers, ...freshHeaders };
  for (let attempt = 0; attempt < 2; attempt++) {
    requestCount += 1;
    let res: Response;
    try {
      res = await fetch(req.url, { method: req.method, headers, body: req.body, credentials: 'include' });
    } catch {
      errorCount += 1;
      await sleep(2000);
      continue;
    }
    if (res.status === 401 || res.status === 403 || /\/ap\/signin/.test(res.url)) throw new AuthError('Merch asked you to sign in again.');
    if (res.status === 429 || res.status >= 500) {
      errorCount += 1;
      await sleep(3000 + attempt * 4000);
      continue;
    }
    if (!res.ok) {
      errorCount += 1;
      return null;
    }
    const text = (await res.text()).replace(/^\)\]\}',?\s*/, '');
    try {
      return { url: req.url, method: req.method, status: res.status, headers, body: req.body, payload: JSON.parse(text), at: Date.now() };
    } catch {
      errorCount += 1;
      return null;
    }
  }
  return null;
}

/** Runs a sales request and follows its pages, if it has any. Null if the first page failed. */
async function executeSales(t: Template, opts: { from?: string; to?: string; marketplace?: MarketplaceId }): Promise<Capture[] | null> {
  const first = await execute(t, opts);
  if (!first) return null;
  const pages = [first];
  if (!t.pages.length && !t.tokenKey) return pages;
  const seen = new Set(learn(first).rows.map((r) => `${r.date}|${r.marketplace}|${r.asin}`));
  let state: PageState = {};
  let current = first;
  for (let i = 0; i < 50; i++) {
    const returned = learn(current).rows.length;
    const next = nextPage(t, state, current.payload, returned, seen.size);
    if (!next) break;
    state = next;
    await jitter();
    const c = await execute(t, { ...opts, page: state });
    if (!c) break;
    const before = seen.size;
    for (const r of learn(c).rows) seen.add(`${r.date}|${r.marketplace}|${r.asin}`);
    if (seen.size === before) break;
    pages.push(c);
    current = c;
  }
  return pages;
}

// ---------- the run ----------

export async function runSync(mode: SyncMode, state: SyncState): Promise<void> {
  requestCount = 0;
  errorCount = 0;
  const settings = await getSettings();
  pace = settings.syncDelayMs;
  let have = await templates();

  // 1. Discovery. Only Connect, or a tab Loupe opened itself, may navigate:
  // a scheduled sync in your own Merch tab never takes you off your page.
  const mayNavigate = mode === 'connect' || state.openedTab === true;
  if (mayNavigate && (mode === 'connect' || !have.sales || !have.catalog)) {
    await report({ phase: 'Looking for your sales report and product list…' });
    const need = () => ({ sales: !have.sales, catalog: !have.catalog });
    if (need().sales || need().catalog) {
      await waitForTemplates(need(), 9_000);
      have = await templates();
    }
    if (need().sales || need().catalog) {
      const visited = state.visited ?? [];
      const next = candidateLinks(document, need()).find((u) => !visited.includes(u) && u !== location.href.split('#')[0]);
      if (next && visited.length < 6) {
        await report({ phase: need().sales ? 'Opening your sales report…' : 'Opening your product list…', visited: [...visited, next] });
        location.assign(next);
        return; // the runner resumes on the next page
      }
    }
    if (!have.sales && !have.catalog) {
      await report({
        status: 'error',
        phase: 'Loupe could not find your sales or products on Merch.',
        error: 'No sales report or product list was recognized. Copy the sync report from Loupe → Settings and send it to the developer.',
        finishedAt: Date.now(),
        stats: { salesRows: 0, catalogItems: 0, requests: requestCount, errors: errorCount },
      });
      await send({ type: 'sync:done' });
      return;
    }
  }

  let salesRows = 0;
  let catalogItems = 0;
  const today = zonedDay(Date.now());

  try {
    // 2. Sales
    if (have.sales) {
      const t = have.sales;
      const meta = await get('meta');
      const markets: Array<MarketplaceId | undefined> = t.markets.length ? MARKETPLACE_IDS : [undefined];
      const historyFrom = addDays(today, -(settings.historyDays - 1));
      const covered = meta.coverage?.salesFrom && meta.coverage.salesFrom <= historyFrom;
      const from = mode === 'quick' ? addDays(today, -1) : covered ? addDays(today, -6) : historyFrom;
      // First day that now has complete daily rows.
      let coveredFrom = from;

      if (!t.window) {
        // A fixed report: replay it as-is.
        await report({ phase: 'Reading your sales report…', progress: { done: 0, total: 1 } });
        const c = await execute(t, {});
        if (c) salesRows += await ingestSales(c);
        coveredFrom = today;
      } else if (t.dated) {
        const plan = markets.flatMap((mp) => chunks(from, today, mode === 'quick' ? 2 : 31).map((range) => ({ mp, range })));
        const empty = new Map<string, number>();
        let done = 0;
        for (const step of plan) {
          done += 1;
          const mpKey = step.mp ?? 'all';
          // A marketplace that's empty for three straight months is skipped further back.
          if ((empty.get(mpKey) ?? 0) >= 3) continue;
          await report({ phase: `Downloading sales ${step.range.from.slice(0, 7)}${step.mp ? ` · ${step.mp}` : ''}`, progress: { done, total: plan.length } });
          let captures: Capture[] | null = await executeSales(t, { from: step.range.from, to: step.range.to, marketplace: step.mp });
          // Some reports reject long ranges: retry the month a week at a time.
          if (!captures && step.range.from !== step.range.to) {
            const weeks: Capture[] = [];
            for (const week of chunks(step.range.from, step.range.to, 7)) {
              weeks.push(...((await executeSales(t, { from: week.from, to: week.to, marketplace: step.mp })) ?? []));
              await jitter();
            }
            captures = weeks;
          }
          let n = 0;
          for (const c of captures ?? []) n += await ingestSales(c);
          salesRows += n;
          empty.set(mpKey, n ? 0 : (empty.get(mpKey) ?? 0) + 1);
          await jitter();
        }
      } else {
        // Reports without per-day dates: one request per day for recent days,
        // plus product totals for 30/90/365-day windows.
        const days = mode === 'quick' ? 2 : Math.min(35, settings.historyDays);
        coveredFrom = addDays(today, -(days - 1));
        const active: Array<MarketplaceId | undefined> = [];
        for (const mp of markets) {
          let found = 0;
          for (const c of (await executeSales(t, { from: addDays(today, -364), to: today, marketplace: mp })) ?? []) found += await ingestTotals(c, 365, today);
          if (found > 0) active.push(mp);
          await jitter();
        }
        const plan = active.flatMap((mp) => [
          ...Array.from({ length: days }, (_, i) => ({ mp, from: addDays(today, -i), to: addDays(today, -i), window: 0 })),
          ...(mode === 'quick' ? [] : [30, 90].map((w) => ({ mp, from: addDays(today, -(w - 1)), to: today, window: w }))),
        ]);
        let done = 0;
        for (const step of plan) {
          done += 1;
          await report({ phase: step.window ? `Reading ${step.window}-day totals${step.mp ? ` · ${step.mp}` : ''}` : `Downloading sales ${step.from}${step.mp ? ` · ${step.mp}` : ''}`, progress: { done, total: plan.length } });
          for (const c of (await executeSales(t, { from: step.from, to: step.to, marketplace: step.mp })) ?? []) {
            if (step.window) await ingestTotals(c, step.window, today);
            else salesRows += await ingestSales(c);
          }
          await jitter();
        }
      }
      if (mode !== 'quick') {
        await update('meta', (m) => ({
          ...m,
          coverage: { ...(m.coverage ?? {}), salesFrom: !m.coverage?.salesFrom || coveredFrom < m.coverage.salesFrom ? coveredFrom : m.coverage.salesFrom, salesTo: today },
        }));
      }
    }

    // 3. Catalog
    if (have.catalog && mode !== 'quick') {
      const t = have.catalog;
      const startedAt = Date.now();
      const seen = new Set<string>();
      let page: PageState = {};
      let pages = 0;
      let complete = false;
      while (pages < 600) {
        pages += 1;
        await report({ phase: `Reading your products · page ${pages}${seen.size ? ` · ${seen.size.toLocaleString()} so far` : ''}`, progress: undefined });
        const c = await execute(t, { page });
        if (!c) break;
        const items = learn(c).items;
        const before = seen.size;
        for (const i of items) seen.add(i.key);
        if (items.length) await send({ type: 'catalog:ingest', items });
        catalogItems = seen.size;
        if (seen.size === before) {
          complete = true;
          break;
        }
        const next = nextPage(t, page, c.payload, items.length, seen.size);
        if (!next) {
          complete = true;
          break;
        }
        page = next;
        await jitter();
      }
      if (complete) await send({ type: 'catalog:complete', startedAt });
      await update('meta', (m) => ({ ...m, coverage: { ...(m.coverage ?? {}), catalogAt: Date.now() } }));
    }

    await report({
      status: have.sales && (have.catalog || mode === 'quick') ? 'done' : 'partial',
      phase: have.sales
        ? have.catalog || mode === 'quick'
          ? 'Synced'
          : 'Sales synced. Loupe has not seen your product list yet: open Manage once.'
        : 'Products synced. Loupe has not seen your sales report yet: open Analyze once.',
      progress: undefined,
      finishedAt: Date.now(),
      stats: { salesRows, catalogItems, requests: requestCount, errors: errorCount },
    });
  } catch (error) {
    await report({
      status: error instanceof AuthError ? 'signin' : 'error',
      phase: error instanceof AuthError ? 'Sign in to Merch on Demand, then sync again.' : 'Sync stopped.',
      error: (error as Error).message,
      finishedAt: Date.now(),
      stats: { salesRows, catalogItems, requests: requestCount, errors: errorCount },
    });
  }
  await send({ type: 'sync:done' });
}

async function ingestSales(c: Capture): Promise<number> {
  const { rows } = learn(c);
  if (!rows.length) return 0;
  const sync: SaleRow[] = rows.map((r) => ({ ...r, source: 'capture' }));
  await send({ type: 'sales:ingest', rows: sync });
  return rows.length;
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
  await send({ type: 'totals:ingest', totals: Array.from(byProduct.values()) });
  return byProduct.size;
}

