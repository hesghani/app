// Your Merch inventory for the Products and Designs pages: every listing
// Merch reports (with its status), joined with what it sold, grouped into
// designs, with filters and previews shared by both pages.

import { useMemo, useState } from 'preact/hooks';
import { convert, share } from '../../shared/analytics';
import { addDays, daysBetween, pacificDay } from '../../shared/dates';
import { designTitleKey } from '../../shared/agent';
import { MARKETPLACES, MARKETPLACE_IDS, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPES, type ProductType } from '../../shared/products';
import type { CatalogStatus } from '../../shared/types';
import { Search } from '../../ui/icons';
import type { Data } from '../data';

export type Status = CatalogStatus | 'unlisted';

export interface Sold { all: number; y365: number; d90: number; d30: number; royalty365: number; royaltyAll: number }

export interface ListingRow {
  key: string;
  asin: string | null;
  marketplace: MarketplaceId | null;
  productType: ProductType | null;
  status: Status;
  rawStatus: string;
  title: string;
  brand: string;
  designKey: string;
  createdAt: string | null;
  price: number | null;
  searchable: boolean | null;
  sold: Sold;
  lastSale: string | null;
}

export interface DesignRow {
  key: string;
  title: string;
  brand: string;
  listings: ListingRow[];
  types: ProductType[];
  marketplaces: MarketplaceId[];
  statuses: Partial<Record<Status, number>>;
  createdAt: string | null;
  sold: Sold;
  lastSale: string | null;
  /** The listing whose picture shows the design best. */
  preview: ListingRow | null;
}

export const STATUS_LABEL: Record<Status, string> = {
  live: 'Live', processing: 'Processing', review: 'In review', rejected: 'Rejected', draft: 'Draft', removed: 'Removed', other: 'Other', unlisted: 'Not in product list',
};
export const STATUS_TONE: Record<Status, string> = {
  live: 'good', processing: 'brand', review: 'brand', rejected: 'bad', draft: 'neutral', removed: 'warn', other: 'neutral', unlisted: 'neutral',
};

const emptySold = (): Sold => ({ all: 0, y365: 0, d90: 0, d30: 0, royalty365: 0, royaltyAll: 0 });

export function useInventory(data: Data): { listings: ListingRow[]; designs: DesignRow[]; today: string } {
  return useMemo(() => {
    const today = pacificDay(Date.now());
    const d30 = addDays(today, -29);
    const d90 = addDays(today, -89);
    const d365 = addDays(today, -364);
    const { displayCurrency: currency, fx } = data.settings;

    // What each marketplace-ASIN sold.
    const sold = new Map<string, Sold & { last: string | null; title: string; type: ProductType | null }>();
    for (const r of data.sales) {
      const key = `${r.marketplace}:${r.asin}`;
      const s = sold.get(key) ?? { ...emptySold(), last: null, title: r.title, type: r.productType };
      const royalty = convert(r.royalty, r.currency, currency, fx);
      s.all += r.units;
      s.royaltyAll += royalty;
      s.y365 += r.units * share(r, d365, today);
      s.royalty365 += royalty * share(r, d365, today);
      s.d90 += r.units * share(r, d90, today);
      s.d30 += r.units * share(r, d30, today);
      const end = r.until ?? r.date;
      if (r.units > 0 && (!s.last || end > s.last)) s.last = end;
      if (!s.title && r.title) s.title = r.title;
      sold.set(key, s);
    }

    const listings: ListingRow[] = [];
    const listed = new Set<string>();
    for (const item of data.catalog) {
      const key = item.asin ? `${item.marketplace ?? 'US'}:${item.asin}` : null;
      const s = key ? sold.get(key) : undefined;
      if (key) listed.add(key);
      listings.push({
        key: item.key,
        asin: item.asin,
        marketplace: item.marketplace,
        productType: item.productType,
        status: item.status,
        rawStatus: item.rawStatus,
        title: item.title,
        brand: item.brand,
        designKey: item.designId ? `d:${item.designId}` : `t:${designTitleKey(item.title)}`,
        createdAt: item.createdAt,
        price: item.price,
        searchable: item.searchable ?? null,
        sold: s ?? emptySold(),
        lastSale: s?.last ?? null,
      });
    }
    // Products that sold but aren't in Merch's product list any more.
    for (const [key, s] of sold) {
      if (listed.has(key)) continue;
      const [mp, asin] = key.split(':') as [MarketplaceId, string];
      listings.push({
        key: `sold:${key}`, asin, marketplace: mp, productType: s.type, status: 'unlisted', rawStatus: '', title: s.title || asin, brand: '',
        designKey: `t:${designTitleKey(s.title || asin)}`, createdAt: null, price: null, searchable: null, sold: s, lastSale: s.last,
      });
    }

    const groups = new Map<string, DesignRow>();
    for (const l of listings) {
      let d = groups.get(l.designKey);
      if (!d) {
        d = { key: l.designKey, title: l.title, brand: l.brand, listings: [], types: [], marketplaces: [], statuses: {}, createdAt: null, sold: emptySold(), lastSale: null, preview: null };
        groups.set(l.designKey, d);
      }
      d.listings.push(l);
      if (!d.brand && l.brand) d.brand = l.brand;
      if (l.productType && !d.types.includes(l.productType)) d.types.push(l.productType);
      if (l.marketplace && !d.marketplaces.includes(l.marketplace)) d.marketplaces.push(l.marketplace);
      d.statuses[l.status] = (d.statuses[l.status] ?? 0) + 1;
      if (l.createdAt && (!d.createdAt || l.createdAt < d.createdAt)) d.createdAt = l.createdAt;
      for (const k of Object.keys(d.sold) as Array<keyof Sold>) d.sold[k] += l.sold[k];
      if (l.lastSale && (!d.lastSale || l.lastSale > d.lastSale)) d.lastSale = l.lastSale;
    }
    for (const d of groups.values()) {
      // A T-shirt in the US shows the design best; any listing with an ASIN will do.
      const rank = (l: ListingRow) => (l.asin ? 0 : 10) + (l.status === 'live' ? 0 : 3) + (l.marketplace === 'US' ? 0 : 1) + (l.productType === 'STANDARD_TSHIRT' ? 0 : 1);
      d.preview = [...d.listings].sort((a, b) => rank(a) - rank(b))[0] ?? null;
      d.marketplaces.sort((a, b) => MARKETPLACE_IDS.indexOf(a) - MARKETPLACE_IDS.indexOf(b));
    }
    return { listings, designs: Array.from(groups.values()), today };
  }, [data.dbVersion, data.settings]);
}

// ---------- previews ----------

/** Amazon's main product picture for an ASIN (the shirt with your design on it). */
export function asinImage(asin: string, mp: MarketplaceId | null, size = 160): string {
  const host = mp === 'JP' ? 'images-fe.ssl-images-amazon.com' : mp && mp !== 'US' ? 'images-eu.ssl-images-amazon.com' : 'images-na.ssl-images-amazon.com';
  return `https://${host}/images/P/${asin}.01._SCLZZZZZZZ_SX${size}_.jpg`;
}

export function Preview({ listing, fallback, size = 52 }: { listing: ListingRow | null; fallback?: ListingRow | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const source = listing?.asin ? listing : fallback?.asin ? fallback : null;
  const type = listing?.productType ?? fallback?.productType ?? null;
  if (!source?.asin || failed) {
    return (
      <span class="preview empty" style={{ width: `${size}px`, height: `${size}px` }} title="No picture yet: the listing has no ASIN">
        {type ? PRODUCT_TYPES[type].short : '—'}
      </span>
    );
  }
  return (
    <img
      class="preview"
      src={asinImage(source.asin, source.marketplace, size * 3)}
      width={size}
      height={size}
      loading="lazy"
      alt=""
      // A missing picture comes back as a 1×1 pixel.
      onLoad={(e) => (e.target as HTMLImageElement).naturalWidth <= 1 && setFailed(true)}
      onError={() => setFailed(true)}
    />
  );
}

// ---------- filters ----------

export type CreatedPreset = 'any' | '7' | '30' | '90' | '365' | 'older';
export type SoldFilter = 'any' | 'ever' | '30' | '365' | 'never';
export type Period = 'all' | 'y365' | 'd90' | 'd30';

export interface Filters {
  q: string;
  mp: MarketplaceId | 'ALL';
  type: ProductType | 'ALL';
  status: Status | 'ALL';
  created: CreatedPreset;
  from: string;
  to: string;
  sold: SoldFilter;
  searchable: 'any' | 'yes' | 'no';
}

export const NO_FILTERS: Filters = { q: '', mp: 'ALL', type: 'ALL', status: 'ALL', created: 'any', from: '', to: '', sold: 'any', searchable: 'any' };

export const PERIOD_LABEL: Record<Period, string> = { all: 'All time', y365: '365 days', d90: '90 days', d30: '30 days' };

export function createdMatches(createdAt: string | null, f: Filters, today: string): boolean {
  if (f.from && (!createdAt || createdAt < f.from)) return false;
  if (f.to && (!createdAt || createdAt > f.to)) return false;
  if (f.created === 'any') return true;
  if (!createdAt) return false;
  const age = daysBetween(createdAt, today);
  return f.created === 'older' ? age > 365 : age < Number(f.created);
}

export function soldMatches(s: Sold, f: Filters): boolean {
  switch (f.sold) {
    case 'ever': return s.all > 0;
    case '30': return s.d30 > 0;
    case '365': return s.y365 > 0;
    case 'never': return s.all === 0;
    default: return true;
  }
}

export function FilterBar({ f, set, types, counts, total, noun }: {
  f: Filters;
  set: (f: Filters) => void;
  types: ProductType[];
  counts: Partial<Record<Status, number>>;
  total: number;
  noun: string;
}) {
  const up = (patch: Partial<Filters>) => set({ ...f, ...patch });
  const statuses = (Object.keys(STATUS_LABEL) as Status[]).filter((s) => counts[s]);
  const active = JSON.stringify(f) !== JSON.stringify(NO_FILTERS);
  return (
    <div class="filters inventory-filters">
      <div class="row">
        <Search size={14} class="muted" />
        <input class="input" style={{ width: '220px' }} placeholder="Title, brand or ASIN" value={f.q} onInput={(e) => up({ q: (e.target as HTMLInputElement).value })} aria-label="Search" />
      </div>
      <select class="select" aria-label="Marketplace" value={f.mp} onChange={(e) => up({ mp: (e.target as HTMLSelectElement).value as Filters['mp'] })}>
        <option value="ALL">All marketplaces</option>
        {MARKETPLACE_IDS.map((id) => <option value={id}>{MARKETPLACES[id].flag} {MARKETPLACES[id].name}</option>)}
      </select>
      <select class="select" aria-label="Product type" value={f.type} onChange={(e) => up({ type: (e.target as HTMLSelectElement).value as Filters['type'] })}>
        <option value="ALL">All product types</option>
        {types.map((t) => <option value={t}>{PRODUCT_TYPES[t].label}</option>)}
      </select>
      <select class="select" aria-label="Status" value={f.status} onChange={(e) => up({ status: (e.target as HTMLSelectElement).value as Filters['status'] })}>
        <option value="ALL">Any status</option>
        {statuses.map((s) => <option value={s}>{STATUS_LABEL[s]} ({counts[s]!.toLocaleString()})</option>)}
      </select>
      <select class="select" aria-label="Created" value={f.created} onChange={(e) => up({ created: (e.target as HTMLSelectElement).value as CreatedPreset })}>
        <option value="any">Created any time</option>
        <option value="7">Created in the last 7 days</option>
        <option value="30">Created in the last 30 days</option>
        <option value="90">Created in the last 90 days</option>
        <option value="365">Created in the last year</option>
        <option value="older">Created over a year ago</option>
      </select>
      <label class="row small muted" style={{ gap: '4px' }}>
        from <input class="input" type="date" value={f.from} onInput={(e) => up({ from: (e.target as HTMLInputElement).value })} aria-label="Created from" />
        to <input class="input" type="date" value={f.to} onInput={(e) => up({ to: (e.target as HTMLInputElement).value })} aria-label="Created to" />
      </label>
      <select class="select" aria-label="Sales" value={f.sold} onChange={(e) => up({ sold: (e.target as HTMLSelectElement).value as SoldFilter })}>
        <option value="any">Any sales</option>
        <option value="ever">Sold at least once</option>
        <option value="365">Sold in the last year</option>
        <option value="30">Sold in the last 30 days</option>
        <option value="never">Never sold</option>
      </select>
      <select class="select" aria-label="Searchable on Amazon" value={f.searchable} onChange={(e) => up({ searchable: (e.target as HTMLSelectElement).value as Filters['searchable'] })}>
        <option value="any">Searchable or not</option>
        <option value="yes">Searchable on Amazon</option>
        <option value="no">Not searchable</option>
      </select>
      {active && <button class="btn sm ghost" onClick={() => set(NO_FILTERS)}>Clear filters</button>}
      <span class="muted small">{total.toLocaleString()} {noun}</span>
    </div>
  );
}
