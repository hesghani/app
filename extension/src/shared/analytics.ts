// Aggregations behind the dashboard: totals, daily series and breakdowns,
// with royalties converted into the user's display currency.

import { addDays, daysBetween, type DayRange } from './dates';
import type { Currency, MarketplaceId } from './marketplaces';
import type { ProductType } from './products';
import type { SaleRow } from './types';

/** Value of one unit of each currency in US dollars. */
export type FxRates = Record<Currency, number>;

export function convert(amount: number, from: Currency, to: Currency, fx: FxRates): number {
  if (from === to) return amount;
  return (amount * fx[from]) / fx[to];
}

export interface Filter {
  range: DayRange;
  marketplaces?: MarketplaceId[];
  productTypes?: ProductType[];
  asin?: string;
}

export function filterRows(rows: SaleRow[], f: Filter): SaleRow[] {
  return rows.filter(
    (r) =>
      r.date >= f.range.from &&
      r.date <= f.range.to &&
      (!f.marketplaces?.length || f.marketplaces.includes(r.marketplace)) &&
      (!f.productTypes?.length || (r.productType !== null && f.productTypes.includes(r.productType))) &&
      (!f.asin || r.asin === f.asin),
  );
}

export interface Totals {
  units: number;
  cancelled: number;
  returned: number;
  royalty: number;
  orders: number;
  asins: number;
  perUnit: number;
}

export function totals(rows: SaleRow[], currency: Currency, fx: FxRates): Totals {
  let units = 0;
  let cancelled = 0;
  let returned = 0;
  let royalty = 0;
  const asins = new Set<string>();
  for (const r of rows) {
    units += r.units;
    cancelled += r.cancelled;
    returned += r.returned;
    royalty += convert(r.royalty, r.currency, currency, fx);
    if (r.units > 0) asins.add(`${r.marketplace}:${r.asin}`);
  }
  return { units, cancelled, returned, royalty, orders: rows.length, asins: asins.size, perUnit: units ? royalty / units : 0 };
}

export interface DayPoint { date: string; units: number; royalty: number }

export function dailySeries(rows: SaleRow[], range: DayRange, currency: Currency, fx: FxRates): DayPoint[] {
  const length = Math.min(daysBetween(range.from, range.to) + 1, 3660);
  const points = new Map<string, DayPoint>();
  for (let i = 0; i < length; i++) {
    const date = addDays(range.from, i);
    points.set(date, { date, units: 0, royalty: 0 });
  }
  for (const r of rows) {
    const p = points.get(r.date);
    if (!p) continue;
    p.units += r.units;
    p.royalty += convert(r.royalty, r.currency, currency, fx);
  }
  return Array.from(points.values());
}

/** Groups daily points into weeks or months when a range is too long to read day by day. */
export function bucketSeries(points: DayPoint[], bucket: 'day' | 'week' | 'month'): DayPoint[] {
  if (bucket === 'day') return points;
  const map = new Map<string, DayPoint>();
  for (const p of points) {
    let key = p.date.slice(0, 7);
    if (bucket === 'week') {
      const d = new Date(`${p.date}T00:00:00Z`);
      const monday = addDays(p.date, -((d.getUTCDay() + 6) % 7));
      key = monday;
    }
    const current = map.get(key) ?? { date: bucket === 'month' ? `${key}-01` : key, units: 0, royalty: 0 };
    current.units += p.units;
    current.royalty += p.royalty;
    map.set(key, current);
  }
  return Array.from(map.values());
}

export interface Breakdown { key: string; units: number; royalty: number; share: number }

export function breakdown(
  rows: SaleRow[],
  by: (r: SaleRow) => string,
  currency: Currency,
  fx: FxRates,
): Breakdown[] {
  const map = new Map<string, Breakdown>();
  let total = 0;
  for (const r of rows) {
    const key = by(r);
    const current = map.get(key) ?? { key, units: 0, royalty: 0, share: 0 };
    current.units += r.units;
    current.royalty += convert(r.royalty, r.currency, currency, fx);
    total += r.units;
    map.set(key, current);
  }
  return Array.from(map.values())
    .map((b) => ({ ...b, share: total ? b.units / total : 0 }))
    .sort((a, b) => b.units - a.units || b.royalty - a.royalty);
}

export interface ProductSummary {
  key: string;
  asin: string;
  marketplace: MarketplaceId;
  title: string;
  productType: ProductType | null;
  units: number;
  royalty: number;
  cancelled: number;
  returned: number;
  firstSale: string | null;
  lastSale: string | null;
  daysSinceSale: number | null;
  /** Units per day over the last 30 days. */
  velocity: number;
}

export function productSummaries(
  allRows: SaleRow[],
  range: DayRange,
  today: string,
  currency: Currency,
  fx: FxRates,
): ProductSummary[] {
  const map = new Map<string, ProductSummary>();
  const recentFrom = addDays(today, -29);
  for (const r of allRows) {
    const key = `${r.marketplace}:${r.asin}`;
    let s = map.get(key);
    if (!s) {
      s = {
        key, asin: r.asin, marketplace: r.marketplace, title: r.title, productType: r.productType,
        units: 0, royalty: 0, cancelled: 0, returned: 0, firstSale: null, lastSale: null, daysSinceSale: null, velocity: 0,
      };
      map.set(key, s);
    }
    if (!s.title && r.title) s.title = r.title;
    if (!s.productType && r.productType) s.productType = r.productType;
    if (r.units > 0) {
      if (!s.firstSale || r.date < s.firstSale) s.firstSale = r.date;
      if (!s.lastSale || r.date > s.lastSale) s.lastSale = r.date;
      if (r.date >= recentFrom && r.date <= today) s.velocity += r.units / 30;
    }
    if (r.date >= range.from && r.date <= range.to) {
      s.units += r.units;
      s.royalty += convert(r.royalty, r.currency, currency, fx);
      s.cancelled += r.cancelled;
      s.returned += r.returned;
    }
  }
  for (const s of map.values()) s.daysSinceSale = s.lastSale ? daysBetween(s.lastSale, today) : null;
  return Array.from(map.values()).sort((a, b) => b.units - a.units || b.royalty - a.royalty);
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return (current - previous) / previous;
}
