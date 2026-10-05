// The learning sync engine.
//
// Merch on Demand has no public API and changes its private one without
// notice, so Loupe never hard-codes endpoints. Instead it watches the
// requests Merch's own pages make while you're signed in. When one returns
// sales or catalog data, Loupe keeps it as a template and works out:
//   - where the date range is (query or JSON body; ISO dates, timestamps…),
//   - where the marketplace is, if anywhere,
//   - how pages are requested (page number, offset, or a next-page token).
// From a template it can then build the same request for any date range,
// any marketplace and any page, which is how it backfills history and reads
// the whole catalog.

import { addDays, daysBetween } from './dates';
import { MARKETPLACES, MARKETPLACE_IDS, marketplaceFromAny, type MarketplaceId } from './marketplaces';
import { normalizeCatalog } from './catalog';
import { normalizeSales, type Context } from './sales';
import { shiftZonedDays, zonedDay } from './zoned';
import type { AccountFacts, CatalogItem, SaleRow } from './types';

export interface Capture {
  url: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
  payload: unknown;
  at: number;
}

type Path = Array<string | number>;
export type Loc = { in: 'query'; key: string } | { in: 'form'; key: string } | { in: 'body'; path: Path };

export type DateFormat = 'iso-date' | 'iso-datetime' | 'epoch-ms' | 'epoch-s' | 'us-date' | 'compact-date';

export interface DateSlot { loc: Loc; role: 'from' | 'to' | 'single'; format: DateFormat; value: string | number }
export interface MarketSlot { loc: Loc; format: 'mid' | 'code' | 'code-lower' | 'gb' | 'domain'; value: string }
export interface PageSlot { loc: Loc; role: 'page' | 'offset' | 'size' | 'token'; value: string | number | null }

export interface Template {
  id: string;
  kind: 'sales' | 'catalog';
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType: 'json' | 'form' | 'none';
  dates: DateSlot[];
  markets: MarketSlot[];
  pages: PageSlot[];
  /** The request already asks for every marketplace. */
  allMarkets: boolean;
  /** Sales rows carry their own dates, so wide date ranges are safe. */
  dated: boolean;
  /** Inclusive Pacific-calendar window of the original request. */
  window: { from: string; to: string } | null;
  tokenKey: string | null;
  rows: number;
  capturedAt: number;
}

export interface Built { method: string; url: string; headers: Record<string, string>; body?: string }

// ---------- small helpers ----------

function words(key: string): string[] {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

const FROM_WORDS = new Set(['from', 'start', 'begin', 'since', 'after', 'min', 'gte', 'gt', 'earliest', 'first', 'low', 'lower']);
const TO_WORDS = new Set(['to', 'end', 'until', 'before', 'max', 'lte', 'lt', 'latest', 'through', 'thru', 'high', 'upper']);
const DATE_WORDS = new Set(['date', 'day', 'time', 'timestamp', 'from', 'to', 'start', 'end', 'since', 'until', 'period', 'begin', 'after', 'before']);

const DESTRUCTIVE = /delete|remove|update|publish|create|submit|save|upload|edit|cancel|archive|patch|duplicate|clone|send|write|modify|logout|signout|purchase\/new/i;

/** Only read requests are ever replayed. */
export function isSafeToReplay(method: string, url: string, body?: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET') return true;
  if (m !== 'POST') return false;
  // GraphQL: queries read, mutations write.
  if (body && /(^|["{\s])mutation\b/.test(body.slice(0, 400))) return false;
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep raw */
  }
  return !DESTRUCTIVE.test(path);
}

function dateFormatOf(value: unknown, key: string): DateFormat | null {
  const dateish = words(key).some((w) => DATE_WORDS.has(w));
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'iso-date';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(value)) return 'iso-datetime';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return 'us-date';
    if (/^20\d{6}$/.test(value) && dateish) return 'compact-date';
    if (/^\d{13}$/.test(value)) return dateFormatOf(Number(value), key);
    if (/^\d{10}$/.test(value)) return dateFormatOf(Number(value), key);
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value > 1.3e12 && value < 2.3e12) return 'epoch-ms';
    if (value > 1.3e9 && value < 2.3e9 && dateish) return 'epoch-s';
  }
  return null;
}

function dayOf(value: string | number, format: DateFormat): string {
  switch (format) {
    case 'iso-date':
    case 'iso-datetime':
      return String(value).slice(0, 10);
    case 'us-date': {
      const [m, d, y] = String(value).split('/');
      return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
    }
    case 'compact-date': {
      const s = String(value);
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    case 'epoch-ms':
      return zonedDay(Number(value));
    case 'epoch-s':
      return zonedDay(Number(value) * 1000);
  }
}

function shiftValue(value: string | number, format: DateFormat, days: number): string | number {
  if (!days) return value;
  const asString = typeof value === 'string';
  switch (format) {
    case 'iso-date':
    case 'iso-datetime': {
      const s = String(value);
      return `${addDays(s.slice(0, 10), days)}${s.slice(10)}`;
    }
    case 'us-date': {
      const [y, m, d] = addDays(dayOf(value, format), days).split('-');
      return `${Number(m)}/${Number(d)}/${y}`;
    }
    case 'compact-date':
      return addDays(dayOf(value, format), days).replace(/-/g, '');
    case 'epoch-ms': {
      const next = shiftZonedDays(Number(value), days);
      return asString ? String(next) : next;
    }
    case 'epoch-s': {
      const next = Math.round(shiftZonedDays(Number(value) * 1000, days) / 1000);
      return asString ? String(next) : next;
    }
  }
}

function marketFormat(value: unknown, key: string): MarketSlot['format'] | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (MARKETPLACE_IDS.some((id) => MARKETPLACES[id].mid === v)) return 'mid';
  const keyIsMarket = /market|country|site|region|locale|store|channel/i.test(key);
  if (!keyIsMarket) return null;
  if (v === 'GB') return 'gb';
  if (/^(US|UK|DE|FR|IT|ES|JP)$/.test(v)) return 'code';
  if (/^(us|uk|gb|de|fr|it|es|jp)$/.test(v)) return 'code-lower';
  if (/^(www\.)?amazon\.[a-z.]+$/i.test(v)) return 'domain';
  return null;
}

function marketValue(format: MarketSlot['format'], mp: MarketplaceId): string {
  switch (format) {
    case 'mid': return MARKETPLACES[mp].mid;
    case 'code': return mp;
    case 'gb': return mp === 'UK' ? 'GB' : mp;
    case 'code-lower': return (mp === 'UK' ? 'gb' : mp).toLowerCase();
    case 'domain': return MARKETPLACES[mp].domain;
  }
}

const PAGE_KEYS: Record<string, PageSlot['role']> = {
  page: 'page', pagenumber: 'page', pageindex: 'page', pageno: 'page', pagenum: 'page', p: 'page',
  offset: 'offset', start: 'offset', skip: 'offset', startindex: 'offset', from: 'offset',
  pagesize: 'size', size: 'size', limit: 'size', perpage: 'size', count: 'size', maxresults: 'size', rows: 'size', pagelength: 'size', resultsperpage: 'size',
  nexttoken: 'token', pagetoken: 'token', cursor: 'token', continuationtoken: 'token', paginationtoken: 'token', nextpagetoken: 'token', startkey: 'token', exclusivestartkey: 'token', after: 'token', nextcursor: 'token', marker: 'token',
};

const TOKEN_RESPONSE_KEYS = ['nexttoken', 'nextpagetoken', 'pagetoken', 'nextcursor', 'cursor', 'continuationtoken', 'paginationtoken', 'lastevaluatedkey', 'nextkey', 'nextmarker', 'marker'];
const TOTAL_KEYS = ['total', 'totalcount', 'totalresults', 'totalitems', 'totalelements', 'totalhits', 'numfound', 'totalrecords', 'totalproducts'];

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- request parameters as a flat list of slots ----------

interface Leaf { loc: Loc; key: string; value: unknown }

function leaves(url: string, body: string | undefined, bodyType: Template['bodyType']): Leaf[] {
  const out: Leaf[] = [];
  const u = new URL(url);
  for (const [key, value] of u.searchParams) out.push({ loc: { in: 'query', key }, key, value });
  if (bodyType === 'form' && body) {
    for (const [key, value] of new URLSearchParams(body)) out.push({ loc: { in: 'form', key }, key, value });
  }
  if (bodyType === 'json' && body) {
    const walk = (node: unknown, path: Path, key: string) => {
      if (Array.isArray(node)) node.forEach((v, i) => walk(v, [...path, i], key));
      else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, [...path, k], k);
      else out.push({ loc: { in: 'body', path }, key, value: node });
    };
    try {
      walk(JSON.parse(body), [], '');
    } catch {
      /* not JSON after all */
    }
  }
  return out;
}

function bodyTypeOf(headers: Record<string, string>, body?: string): Template['bodyType'] {
  if (!body) return 'none';
  const type = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
  if (/json/i.test(type) || /^[\s]*[{[]/.test(body)) return 'json';
  if (/form-urlencoded/i.test(type) || /^[\w%.-]+=/.test(body)) return 'form';
  return 'none';
}

function detectDates(list: Leaf[]): DateSlot[] {
  const found: Array<DateSlot & { roleGuess: DateSlot['role'] | null }> = [];
  for (const leaf of list) {
    if (leaf.value === null || leaf.value === undefined) continue;
    const format = dateFormatOf(leaf.value, leaf.key);
    if (!format) continue;
    const w = words(leaf.key);
    const roleGuess = w.some((x) => FROM_WORDS.has(x)) ? 'from' : w.some((x) => TO_WORDS.has(x)) ? 'to' : null;
    found.push({ loc: leaf.loc, role: 'single', roleGuess, format, value: leaf.value as string | number });
  }
  if (found.length === 1) return [{ ...found[0]!, role: found[0]!.roleGuess ?? 'single' }].map(strip);
  if (found.length >= 2) {
    const unknown = found.filter((f) => !f.roleGuess);
    if (unknown.length === found.length) {
      const sorted = [...found].sort((a, b) => dayOf(a.value, a.format).localeCompare(dayOf(b.value, b.format)));
      sorted[0]!.roleGuess = 'from';
      sorted[sorted.length - 1]!.roleGuess = 'to';
    }
    return found.filter((f) => f.roleGuess).map((f) => strip({ ...f, role: f.roleGuess! }));
  }
  return [];
}

function strip(s: DateSlot & { roleGuess?: unknown }): DateSlot {
  return { loc: s.loc, role: s.role, format: s.format, value: s.value };
}

function windowOf(dates: DateSlot[]): Template['window'] {
  if (!dates.length) return null;
  const from = dates.find((d) => d.role === 'from') ?? dates.find((d) => d.role === 'single');
  const to = dates.find((d) => d.role === 'to') ?? dates.find((d) => d.role === 'single');
  if (!from || !to) return null;
  let toDay = dayOf(to.value, to.format);
  // An exclusive end at midnight ("toDate=Oct 5 00:00") means the window ends Oct 4.
  if ((to.format === 'epoch-ms' || to.format === 'epoch-s') && to.role === 'to') {
    const ms = Number(to.value) * (to.format === 'epoch-s' ? 1000 : 1);
    toDay = zonedDay(ms - 1);
  }
  const fromDay = dayOf(from.value, from.format);
  return { from: fromDay, to: toDay < fromDay ? fromDay : toDay };
}

function detectMarkets(list: Leaf[]): { markets: MarketSlot[]; all: boolean } {
  const markets: MarketSlot[] = [];
  const perArray = new Map<string, number>();
  for (const leaf of list) {
    const format = marketFormat(leaf.value, leaf.key || (leaf.loc.in === 'body' ? String(leaf.loc.path[leaf.loc.path.length - 2] ?? '') : ''));
    if (!format) continue;
    markets.push({ loc: leaf.loc, format, value: String(leaf.value) });
    if (leaf.loc.in === 'body' && typeof leaf.loc.path[leaf.loc.path.length - 1] === 'number') {
      const parent = JSON.stringify(leaf.loc.path.slice(0, -1));
      perArray.set(parent, (perArray.get(parent) ?? 0) + 1);
    }
  }
  // Several marketplace IDs in one array means the request already covers them all.
  const all = Array.from(perArray.values()).some((n) => n >= 2);
  return { markets: all ? [] : markets, all };
}

function detectPages(list: Leaf[]): PageSlot[] {
  const pages: PageSlot[] = [];
  for (const leaf of list) {
    const role = PAGE_KEYS[norm(leaf.key)];
    if (!role) continue;
    if (role === 'token') pages.push({ loc: leaf.loc, role, value: (leaf.value as string | null) ?? null });
    else {
      const n = Number(leaf.value);
      if (Number.isFinite(n) && n >= 0 && n < 1e6 && dateFormatOf(leaf.value, leaf.key) === null) pages.push({ loc: leaf.loc, role, value: leaf.value as number | string });
    }
  }
  return pages;
}

function findKey(payload: unknown, keys: string[], depth = 2): { key: string; value: unknown } | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const [k, v] of Object.entries(payload)) {
    if (keys.includes(norm(k)) && v !== null && v !== undefined && v !== '') return { key: k, value: v };
  }
  if (depth > 1) {
    for (const v of Object.values(payload)) {
      const hit = findKey(v, keys, depth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

export function templateId(method: string, url: string, body?: string): string {
  const u = new URL(url);
  let bodyKeys = '';
  try {
    if (body) bodyKeys = Object.keys(JSON.parse(body) as object).sort().join(',');
  } catch {
    bodyKeys = body ? Array.from(new URLSearchParams(body).keys()).sort().join(',') : '';
  }
  return `${method.toUpperCase()} ${u.host}${u.pathname}?${Array.from(u.searchParams.keys()).sort().join(',')}#${bodyKeys}`;
}

// ---------- learning from one captured response ----------

export interface Learned {
  kind: 'sales' | 'catalog' | 'none';
  /** Daily sales rows, safe to store as they are. */
  rows: SaleRow[];
  /** Product rows in a report of totals for a multi-day range (no per-row dates). Not stored as daily rows. */
  totals: number;
  dated: boolean;
  items: CatalogItem[];
  account: AccountFacts | null;
  template: Template | null;
}

/** Day and marketplace a request asks for, wherever they sit (URL or body). */
export function requestContext(c: Capture): Context {
  const ctx: Context = {};
  try {
    const bodyType = bodyTypeOf(c.headers, c.body);
    const list = leaves(c.url, c.body, bodyType);
    const window = windowOf(detectDates(list));
    if (window && window.from === window.to) {
      ctx.date = window.from;
      ctx.dateSource = 'url';
    }
    const { markets } = detectMarkets(list);
    const mp = markets.length === 1 ? marketplaceFromAny(markets[0]!.value === 'GB' ? 'UK' : markets[0]!.value) : null;
    if (mp) ctx.marketplace = mp;
  } catch {
    /* malformed URL or body */
  }
  return ctx;
}

const SALES_PATH = /sale|purchase|royalt|report|analy|order|earning|revenue/i;

function hasArray(payload: unknown, depth = 3): boolean {
  if (Array.isArray(payload)) return true;
  if (!payload || typeof payload !== 'object' || depth === 0) return false;
  return Object.values(payload).some((v) => hasArray(v, depth - 1));
}

/**
 * A sales report that happens to be empty (no sales yet today) still teaches
 * Loupe how to ask for sales. It's kept as a candidate with 0 rows and
 * verified later with a wider date range.
 */
function isSalesCandidate(c: Capture, dates: DateSlot[]): boolean {
  let path = '';
  try {
    path = new URL(c.url).pathname;
  } catch {
    return false;
  }
  return dates.length > 0 && SALES_PATH.test(`${path} ${c.body ?? ''}`) && hasArray(c.payload);
}

export function learn(c: Capture): Learned {
  const ctx = requestContext(c);
  const { rows, dated } = normalizeSales(c.payload, c.url, ctx);
  let bodyType: Template['bodyType'] = 'none';
  let list: Leaf[] = [];
  let dates: DateSlot[] = [];
  try {
    bodyType = bodyTypeOf(c.headers, c.body);
    list = leaves(c.url, c.body, bodyType);
    dates = detectDates(list);
  } catch {
    /* malformed URL or body */
  }
  // Most sales reports are totals per product for the requested range, with
  // no date on each row. They're the template for range totals and, asked
  // one day at a time, for daily rows.
  let totals = 0;
  const range = windowOf(dates);
  if (!rows.length && range && range.from !== range.to) {
    totals = normalizeSales(c.payload, c.url, { ...ctx, date: range.to, dateSource: 'url' }).rows.length;
  }
  const items = rows.length || totals ? [] : normalizeCatalog(c.payload, c.at);
  const account = accountFacts(c.payload, c.at);
  let kind: Learned['kind'] = rows.length || totals ? 'sales' : items.length ? 'catalog' : 'none';
  let template: Template | null = null;
  if (c.status < 400 && isSafeToReplay(c.method, c.url, c.body)) {
    if (kind === 'none' && isSalesCandidate(c, dates)) kind = 'sales';
    if (kind === 'none') return { kind, rows, totals, dated, items, account, template };
    const { markets, all } = detectMarkets(list);
    const token = findKey(c.payload, TOKEN_RESPONSE_KEYS);
    template = {
      id: templateId(c.method, c.url, c.body),
      kind,
      method: c.method.toUpperCase(),
      url: c.url,
      headers: c.headers,
      body: c.body,
      bodyType,
      dates,
      markets,
      pages: detectPages(list),
      allMarkets: all,
      dated: rows.length > 0 && dated,
      window: range,
      tokenKey: token && typeof token.value === 'string' ? token.key : null,
      rows: kind === 'sales' ? rows.length || totals : items.length,
      capturedAt: c.at,
    };
  }
  return { kind, rows, totals, dated, items, account, template };
}

/** Better templates first: proven rows, dated rows, a date range or paging, then the most recent. */
export function rankTemplates(list: Template[]): Template[] {
  const score = (t: Template) =>
    (t.rows > 0 ? 8 : 0) + (t.dated ? 4 : 0) + (t.dates.length ? 2 : 0) + (canPage(t) ? 2 : 0) + (t.rows >= 50 ? 1 : 0);
  return [...list].sort((a, b) => score(b) - score(a) || b.rows - a.rows || b.capturedAt - a.capturedAt);
}

function canPage(t: Template): boolean {
  return t.tokenKey !== null || t.pages.some((p) => p.role === 'page' || p.role === 'offset' || p.role === 'token');
}

/** A sales request Loupe can move through time, and that has returned sales. */
export function isStrongSales(t: Template | null | undefined): boolean {
  return Boolean(t && t.kind === 'sales' && t.window && t.rows > 0);
}

/** A sales request with a date range that returned nothing yet: worth verifying with a wider range. */
export function isUnverifiedSales(t: Template | null | undefined): boolean {
  return Boolean(t && t.kind === 'sales' && t.window && t.rows === 0);
}

/**
 * A product list Loupe can read in full: it pages, or it already returned a
 * lot. A dashboard widget showing your 10 newest products is not a catalog.
 */
export function isStrongCatalog(t: Template | null | undefined): boolean {
  return Boolean(t && t.kind === 'catalog' && (canPage(t) || t.rows >= 50));
}

// ---------- building new requests ----------

export interface PageState { page?: number; offset?: number; token?: string | null; size?: number }

function setAt(target: { query: URLSearchParams; form: URLSearchParams | null; body: unknown }, loc: Loc, value: unknown) {
  if (loc.in === 'query') {
    if (value === null || value === undefined) target.query.delete(loc.key);
    else target.query.set(loc.key, String(value));
  } else if (loc.in === 'form') {
    if (!target.form) return;
    if (value === null || value === undefined) target.form.delete(loc.key);
    else target.form.set(loc.key, String(value));
  } else {
    let node = target.body as Record<string | number, unknown>;
    for (const step of loc.path.slice(0, -1)) {
      if (node[step] === undefined || node[step] === null) node[step] = {};
      node = node[step] as Record<string | number, unknown>;
    }
    node[loc.path[loc.path.length - 1]!] = value;
  }
}

export function buildRequest(
  t: Template,
  opts: { from?: string; to?: string; marketplace?: MarketplaceId; page?: PageState } = {},
): Built {
  const u = new URL(t.url);
  const target = {
    query: u.searchParams,
    form: t.bodyType === 'form' && t.body ? new URLSearchParams(t.body) : null,
    body: t.bodyType === 'json' && t.body ? (JSON.parse(t.body) as unknown) : null,
  };

  if (t.window && (opts.from || opts.to)) {
    const deltaFrom = opts.from ? daysBetween(t.window.from, opts.from) : 0;
    const deltaTo = opts.to ? daysBetween(t.window.to, opts.to) : 0;
    for (const slot of t.dates) {
      const delta = slot.role === 'from' ? deltaFrom : deltaTo;
      setAt(target, slot.loc, shiftValue(slot.value, slot.format, delta));
    }
  }

  if (opts.marketplace) for (const slot of t.markets) setAt(target, slot.loc, marketValue(slot.format, opts.marketplace));

  const page = opts.page;
  if (page) {
    for (const slot of t.pages) {
      if (slot.role === 'page' && page.page !== undefined) setAt(target, slot.loc, typeof slot.value === 'string' ? String(page.page) : page.page);
      if (slot.role === 'offset' && page.offset !== undefined) setAt(target, slot.loc, typeof slot.value === 'string' ? String(page.offset) : page.offset);
      if (slot.role === 'size' && page.size !== undefined) setAt(target, slot.loc, typeof slot.value === 'string' ? String(page.size) : page.size);
      if (slot.role === 'token') setAt(target, slot.loc, page.token ?? null);
    }
    // The first request had no token parameter; add one named like the response field.
    if (page.token && !t.pages.some((p) => p.role === 'token') && t.tokenKey) {
      const name = /cursor/i.test(t.tokenKey) ? t.tokenKey.replace(/^next/i, '').replace(/^./, (c) => c.toLowerCase()) || 'cursor' : t.tokenKey;
      if (t.bodyType === 'json' && target.body && typeof target.body === 'object') (target.body as Record<string, unknown>)[name] = page.token;
      else target.query.set(name, page.token);
    }
  }

  const body = target.body !== null ? JSON.stringify(target.body) : target.form ? target.form.toString() : t.body;
  return { method: t.method, url: u.href, headers: t.headers, body: t.method === 'GET' ? undefined : body };
}

/** The next page to request after `payload`, or null when the list is complete. */
export function nextPage(t: Template, current: PageState, payload: unknown, returned: number, seen: number): PageState | null {
  if (returned === 0) return null;
  const total = findKey(payload, TOTAL_KEYS);
  if (total && typeof total.value === 'number' && seen >= total.value) return null;
  const token = t.tokenKey ? findKey(payload, [norm(t.tokenKey)]) : findKey(payload, TOKEN_RESPONSE_KEYS);
  if (token && typeof token.value === 'string' && token.value && token.value !== current.token) return { ...current, token: token.value };
  if (token === null && (t.tokenKey || t.pages.some((p) => p.role === 'token'))) return null;
  const pageSlot = t.pages.find((p) => p.role === 'page');
  if (pageSlot) {
    const start = current.page ?? Number(pageSlot.value);
    return { ...current, page: start + 1 };
  }
  const offsetSlot = t.pages.find((p) => p.role === 'offset');
  if (offsetSlot) {
    const start = current.offset ?? Number(offsetSlot.value);
    return { ...current, offset: start + returned };
  }
  return null;
}

/** Splits [from, to] into chunks of at most `size` days, newest first. */
export function chunks(from: string, to: string, size: number): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let end = to;
  while (end >= from) {
    const start = addDays(end, -(size - 1));
    out.push({ from: start < from ? from : start, to: end });
    end = addDays(start, -1);
  }
  return out;
}

// ---------- account facts ----------

const FACT = /tier|limit|quota|remaining|slots?$|maxdesigns|maxproducts|dailypublish|uploadsleft|uploadstoday|publishedtoday|livedesigns|liveproducts|designcount|productcount|uploadcount|publishcount/;

export function accountFacts(payload: unknown, at: number): AccountFacts | null {
  const facts: Record<string, number> = {};
  let tier: number | undefined;
  const walk = (node: unknown, path: string, depth: number) => {
    if (depth > 4 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) return;
    for (const [k, v] of Object.entries(node)) {
      const key = norm(k);
      const here = path ? `${path}.${k}` : k;
      if (typeof v === 'number' && FACT.test(key)) facts[here] = v;
      if (/^(tier|currenttier|tierlevel|accounttier|producttier|tiername|tiervalue)$/.test(key)) {
        const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d]/g, ''));
        if (Number.isFinite(n) && n >= 10 && n <= 1_000_000) tier = n;
      }
      if (v && typeof v === 'object') walk(v, here, depth + 1);
    }
  };
  walk(payload, '', 0);
  if (tier === undefined && !Object.keys(facts).length) return null;
  return { tier, facts, seenAt: at };
}

// ---------- redacted description for the sync report ----------

export function describeShape(payload: unknown, maxKeys = 50): string[] {
  const out: string[] = [];
  const walk = (node: unknown, path: string, depth: number) => {
    if (out.length >= maxKeys || depth > 5) return;
    if (Array.isArray(node)) {
      out.push(`${path || '$'}: array(${node.length})`);
      if (node.length) walk(node[0], `${path}[]`, depth + 1);
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, depth + 1);
    } else {
      out.push(`${path || '$'}: ${kindOf(node, path)}`);
    }
  };
  walk(payload, '', 0);
  return out;
}

export function kindOf(value: unknown, key = ''): string {
  if (value === null || value === undefined) return 'null';
  const fmt = dateFormatOf(value, key);
  if (fmt) return fmt;
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  const s = String(value);
  if (/^[A-Z0-9]{10}$/.test(s) && /^B0/.test(s)) return 'asin';
  if (marketplaceFromAny(s)) return `marketplace(${s.length <= 14 ? s : 'id'})`;
  if (/^-?\d+(\.\d+)?$/.test(s)) return 'numeric-string';
  if (/^[A-Z_]{3,40}$/.test(s)) return `enum(${s})`;
  return `string(${Math.min(s.length, 99)})`;
}

export function describeRequest(method: string, url: string, body?: string): string {
  const u = new URL(url);
  const params = Array.from(u.searchParams.entries()).map(([k, v]) => `${k}=<${kindOf(v, k)}>`);
  let bodyShape = '';
  if (body) {
    try {
      bodyShape = ` body{${describeShape(JSON.parse(body), 25).join('; ')}}`;
    } catch {
      bodyShape = ` body(${body.length} chars)`;
    }
  }
  return `${method.toUpperCase()} ${u.host}${u.pathname}${params.length ? `?${params.join('&')}` : ''}${bodyShape}`;
}
