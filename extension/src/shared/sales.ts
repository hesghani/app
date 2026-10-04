// Sales data: turning whatever the Merch on Demand dashboard loads into
// SaleRow records, merging them into the local store, and importing CSVs.
//
// Merch has no public API and its internal one changes without notice, so
// the normalizer doesn't depend on any endpoint or schema. It walks any JSON
// payload and accepts objects that carry an ASIN plus a unit or royalty
// count, resolving each field from a list of plausible key names. Fields a
// row lacks (date, marketplace, currency) are inherited from parent objects
// or, as a last resort, from the request URL.

import { pacificDay, parseLooseDate } from './dates';
import { MARKETPLACES, marketplaceFromAny, type Currency, type MarketplaceId } from './marketplaces';
import { productTypeFromLabel } from './products';
import { parseCsv } from './csv';
import type { SaleRow } from './types';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const KEYS = {
  asin: ['asin', 'childasin', 'productasin', 'itemasin'],
  date: ['date', 'day', 'purchasedate', 'orderdate', 'saledate', 'salesdate', 'transactiondate', 'reportdate', 'perioddate', 'datetime', 'purchasedatetime', 'timestamp', 'periodstart', 'time'],
  units: ['units', 'unitssold', 'unitspurchased', 'purchasedunits', 'netunits', 'soldunits', 'purchased', 'quantity', 'qty', 'sold', 'unitcount', 'orders', 'sales'],
  cancelled: ['cancelled', 'canceled', 'unitscancelled', 'unitscanceled', 'cancellations', 'cancelledunits', 'canceledunits'],
  returned: ['returned', 'returns', 'unitsreturned', 'returnedunits'],
  royalty: ['royalty', 'royalties', 'royaltyamount', 'totalroyalty', 'totalroyalties', 'royaltyvalue', 'netroyalty', 'netroyalties', 'earnings'],
  currency: ['currency', 'currencycode', 'royaltycurrency', 'royaltycurrencycode'],
  marketplace: ['marketplace', 'marketplaceid', 'marketplacename', 'marketplacecode', 'market', 'countrycode', 'country', 'site', 'domain', 'storefront'],
  productType: ['producttype', 'garmenttype', 'shirttype', 'productcategory', 'producttypename', 'type'],
  title: ['title', 'producttitle', 'designtitle', 'listingtitle', 'itemname', 'name', 'productname'],
} as const;

type Field = keyof typeof KEYS;

function norm(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(obj: Obj, field: Field): Json | undefined {
  const entries = Object.entries(obj);
  for (const alias of KEYS[field]) {
    const hit = entries.find(([k]) => norm(k) === alias);
    if (hit && hit[1] !== null && hit[1] !== '') return hit[1];
  }
  return undefined;
}

function isObj(v: Json | undefined): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Numbers may arrive as 5.27, "5.27", "$5.27", "5,27 €" or {amount: 5.27, currencyCode: "USD"}. */
function toMoney(v: Json | undefined): { value: number | null; currency: Currency | null } {
  if (v === undefined || v === null) return { value: null, currency: null };
  if (typeof v === 'number') return { value: Number.isFinite(v) ? v : null, currency: null };
  if (typeof v === 'string') {
    const currency = currencyFromText(v);
    const cleaned = v.replace(/[^\d.,-]/g, '');
    if (!cleaned) return { value: null, currency };
    const comma = cleaned.lastIndexOf(',');
    const dot = cleaned.lastIndexOf('.');
    const normalized = comma > dot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
    const n = Number(normalized);
    return { value: Number.isFinite(n) ? n : null, currency };
  }
  if (isObj(v)) {
    const amount = v.amount ?? v.value ?? v.total ?? v.royalty;
    const code = v.currencyCode ?? v.currency ?? v.code;
    const inner = toMoney(amount as Json);
    return { value: inner.value, currency: currencyFromText(typeof code === 'string' ? code : '') ?? inner.currency };
  }
  return { value: null, currency: null };
}

function toCount(v: Json | undefined): number | null {
  const { value } = toMoney(v);
  return value === null ? null : Math.round(value);
}

function currencyFromText(text: string): Currency | null {
  const t = text.trim().toUpperCase();
  if (t === 'USD' || t.includes('$')) return 'USD';
  if (t === 'GBP' || t.includes('£')) return 'GBP';
  if (t === 'EUR' || t.includes('€')) return 'EUR';
  if (t === 'JPY' || t.includes('¥') || t.includes('￥')) return 'JPY';
  return null;
}

/** Dates may be "2026-10-04", "2026-10-04T07:00:00Z", "10/04/2026", epoch ms or epoch seconds. */
export function toDay(v: Json | undefined): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') {
    if (v > 1e11) return pacificDay(v);
    if (v > 1e9) return pacificDay(v * 1000);
    return null;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`;
  if (/^\d{10,13}$/.test(s)) return toDay(Number(s));
  return parseLooseDate(s);
}

export interface Context {
  date?: string;
  marketplace?: MarketplaceId;
  currency?: Currency;
}

function marketplaceFromCurrency(currency: Currency | null | undefined): MarketplaceId | undefined {
  if (currency === 'USD') return 'US';
  if (currency === 'GBP') return 'UK';
  if (currency === 'JPY') return 'JP';
  if (currency === 'EUR') return 'DE';
  return undefined;
}

/** The object's own fields plus those of its direct child objects, own fields winning. */
function withChildFields(obj: Obj): Obj {
  const merged: Obj = {};
  for (const value of Object.values(obj)) {
    if (isObj(value) && !('amount' in value) && !('currencyCode' in value)) Object.assign(merged, value);
  }
  return Object.assign(merged, obj);
}

function rowFrom(source: Obj, ctx: Context): SaleRow | null {
  const asinRaw = pick(source, 'asin');
  const asin = typeof asinRaw === 'string' ? asinRaw.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null;
  const obj = withChildFields(source);

  const unitsRaw = pick(obj, 'units');
  const royaltyRaw = toMoney(pick(obj, 'royalty'));
  const units = toCount(unitsRaw);
  if (units === null && royaltyRaw.value === null) return null;

  const date = toDay(pick(obj, 'date')) ?? ctx.date;
  if (!date) return null;

  const currencyRaw = pick(obj, 'currency');
  const currency =
    royaltyRaw.currency ?? (typeof currencyRaw === 'string' ? currencyFromText(currencyRaw) : null) ?? ctx.currency ?? null;
  const marketplace =
    marketplaceFromAny(pick(obj, 'marketplace')) ?? ctx.marketplace ?? marketplaceFromCurrency(currency);
  if (!marketplace) return null;

  const typeRaw = pick(obj, 'productType');
  const titleRaw = pick(obj, 'title');
  return {
    date,
    marketplace,
    asin,
    productType: productTypeFromLabel(typeof typeRaw === 'string' ? typeRaw : null),
    title: typeof titleRaw === 'string' ? titleRaw.trim().slice(0, 200) : '',
    units: units ?? 0,
    cancelled: toCount(pick(obj, 'cancelled')) ?? 0,
    returned: toCount(pick(obj, 'returned')) ?? 0,
    royalty: royaltyRaw.value ?? 0,
    currency: currency ?? MARKETPLACES[marketplace].currency,
    source: 'capture',
  };
}

function extendContext(obj: Obj, ctx: Context): Context {
  const next = { ...ctx };
  const date = toDay(pick(obj, 'date'));
  if (date) next.date = date;
  const mp = marketplaceFromAny(pick(obj, 'marketplace'));
  if (mp) next.marketplace = mp;
  const cur = pick(obj, 'currency');
  const currency = typeof cur === 'string' ? currencyFromText(cur) : null;
  if (currency) next.currency = currency;
  return next;
}

/** Reads a single-day date range out of the request URL, if it has one. */
export function contextFromUrl(url: string): Context {
  const ctx: Context = {};
  let params: URLSearchParams;
  try {
    params = new URL(url, 'https://merch.amazon.com').searchParams;
  } catch {
    return ctx;
  }
  const days = new Set<string>();
  for (const [key, value] of params) {
    const k = norm(key);
    if (/date|day|from|to|start|end/.test(k)) {
      const day = toDay(/^\d+$/.test(value) ? Number(value) : value);
      if (day) days.add(day);
    }
    if (/marketplace|market|country/.test(k)) {
      const mp = marketplaceFromAny(value);
      if (mp) ctx.marketplace = mp;
    }
  }
  if (days.size === 1) ctx.date = Array.from(days)[0];
  return ctx;
}

export function rowKey(r: Pick<SaleRow, 'date' | 'marketplace' | 'asin' | 'productType'>): string {
  return `${r.date}|${r.marketplace}|${r.asin}|${r.productType ?? ''}`;
}

/** Sums rows that share a key (a payload may list one row per order or per size). */
export function aggregate(rows: SaleRow[]): SaleRow[] {
  const map = new Map<string, SaleRow>();
  for (const r of rows) {
    const key = rowKey(r);
    const current = map.get(key);
    if (!current) map.set(key, { ...r });
    else {
      current.units += r.units;
      current.cancelled += r.cancelled;
      current.returned += r.returned;
      current.royalty = Math.round((current.royalty + r.royalty) * 100) / 100;
      if (!current.title && r.title) current.title = r.title;
    }
  }
  return Array.from(map.values());
}

export function normalizePayload(payload: unknown, url = ''): SaleRow[] {
  const rows: SaleRow[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: Json, ctx: Context, depth: number) => {
    if (depth > 12 || node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, ctx, depth + 1);
      return;
    }
    const row = rowFrom(node, ctx);
    if (row) {
      rows.push(row);
      return;
    }
    const next = extendContext(node, ctx);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value, next, depth + 1);
    }
  };
  walk(payload as Json, contextFromUrl(url), 0);
  return aggregate(rows);
}

/** Top-level keys of a payload, for the capture log in Settings → Diagnostics. */
export function payloadShape(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === 'object' ? Object.keys(first).slice(0, 12).map((k) => `[].${k}`) : ['[]'];
  }
  return payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 12) : [];
}

export interface NewSale { row: SaleRow; units: number; royalty: number }

export interface MergeResult {
  store: Record<string, SaleRow>;
  added: number;
  updated: number;
  newSales: NewSale[];
}

/**
 * Merges incoming rows. A re-captured day replaces the stored one (totals for
 * a day only grow or get corrected). Increases on recent days are reported as
 * new sales so the background worker can notify, but never on the very first
 * import, which would otherwise announce a year of history.
 */
export function mergeSales(
  store: Record<string, SaleRow>,
  incoming: SaleRow[],
  today: string,
  recentDays: string[] = [today],
): MergeResult {
  const next = { ...store };
  const firstImport = Object.keys(store).length === 0;
  let added = 0;
  let updated = 0;
  const newSales: NewSale[] = [];
  for (const row of incoming) {
    const key = rowKey(row);
    const prev = next[key];
    if (!prev) added += 1;
    else if (prev.units !== row.units || prev.royalty !== row.royalty || prev.cancelled !== row.cancelled) updated += 1;
    else continue;
    const title = row.title || prev?.title || '';
    next[key] = { ...row, title };
    const deltaUnits = row.units - (prev?.units ?? 0);
    if (!firstImport && deltaUnits > 0 && recentDays.includes(row.date)) {
      newSales.push({ row: next[key]!, units: deltaUnits, royalty: Math.round((row.royalty - (prev?.royalty ?? 0)) * 100) / 100 });
    }
  }
  return { store: next, added, updated, newSales };
}

// ---------- CSV import ----------

const CSV_HEADERS: Record<Field, RegExp> = {
  date: /^(?:date|day|purchase ?date|order ?date|sale ?date|datum|fecha|data|日付)$/i,
  asin: /asin/i,
  units: /^(?!.*(?:cancel|return))(?:units?|units? ?sold|purchased|quantity|qty|sold|net ?units|einheiten|ventes|unidades|販売数)/i,
  cancelled: /cancel/i,
  returned: /return/i,
  royalty: /royalt|lizenzgeb|redevance|regalía|ロイヤリティ/i,
  currency: /^currency|währung|devise|moneda/i,
  marketplace: /marketplace|market|country|site|store|marktplatz/i,
  productType: /product ?type|garment|shirt ?type|^type$|produkttyp/i,
  title: /^(?:title|product ?title|name|design|titel|titre|título)/i,
};

export interface CsvMapping { [field: string]: number }

export function mapCsvHeaders(headers: string[]): CsvMapping {
  const mapping: CsvMapping = {};
  (Object.keys(CSV_HEADERS) as Field[]).forEach((field) => {
    const index = headers.findIndex((h, i) => CSV_HEADERS[field].test(h.trim()) && !Object.values(mapping).includes(i));
    if (index >= 0) mapping[field] = index;
  });
  return mapping;
}

export interface CsvImport {
  rows: SaleRow[];
  skipped: number;
  mapping: CsvMapping;
  headers: string[];
}

export function importSalesCsv(text: string, fallbackMarketplace: MarketplaceId): CsvImport {
  const table = parseCsv(text);
  const headers = table[0] ?? [];
  const mapping = mapCsvHeaders(headers);
  const rows: SaleRow[] = [];
  let skipped = 0;
  for (const cells of table.slice(1)) {
    const obj: Obj = {};
    for (const [field, index] of Object.entries(mapping)) obj[field] = cells[index] ?? null;
    const row = rowFrom(obj, { marketplace: fallbackMarketplace });
    if (row) rows.push({ ...row, source: 'csv' });
    else skipped += 1;
  }
  return { rows: aggregate(rows), skipped, mapping, headers };
}
