// The portfolio agent. It joins your catalog with your sales, groups products
// into designs and niches, and turns the numbers into a ranked list of
// actions: what to replace, what to scale, which niches to double down on,
// what's rising or fading, and which seasons to prepare for.
//
// Everything here is deterministic and explainable: every recommendation
// says which numbers triggered it.

import { addDays, daysBetween } from './dates';
import { convert, rowEnd, share, type FxRates } from './analytics';
import { MARKETPLACES, MARKETPLACE_IDS, type Currency, type MarketplaceId } from './marketplaces';
import { PRODUCT_TYPES, type ProductType } from './products';
import { DEFAULT_ROYALTY_MODEL, type RoyaltyModel, type RoyaltyTier } from './royalty';
import { SEASONS, upcomingSeasons, type UpcomingSeason } from './seasons';
import { fold } from './text';
import type { CatalogItem, RangeTotal, SaleRow } from './types';

// ---------- inputs and outputs ----------

export interface AgentInput {
  sales: SaleRow[];
  catalog: CatalogItem[];
  totals: RangeTotal[];
  /** Pacific "today", YYYY-MM-DD. */
  today: string;
  /** First day of complete daily sales history, if known. */
  coverageFrom: string | null;
  currency: Currency;
  fx: FxRates;
  designLimit: number | null;
  royalty?: RoyaltyModel;
  tier?: RoyaltyTier;
}

export interface ProductStat {
  key: string;
  asin: string | null;
  marketplace: MarketplaceId | null;
  productType: ProductType | null;
  status: CatalogItem['status'] | 'unknown';
  price: number | null;
  u30: number;
  u90: number;
  u365: number;
  prev60: number;
  r30: number;
  r90: number;
  r365: number;
  returns365: number;
  cancels365: number;
  lastSale: string | null;
  firstSale: string | null;
}

export interface Design {
  key: string;
  title: string;
  brand: string;
  products: ProductStat[];
  types: ProductType[];
  marketplaces: MarketplaceId[];
  live: boolean;
  createdAt: string | null;
  ageDays: number | null;
  u30: number;
  u90: number;
  u365: number;
  prev60: number;
  r30: number;
  r90: number;
  r365: number;
  returns365: number;
  cancels365: number;
  lastSale: string | null;
  /** Units per calendar month (index 0 = January) over the last year. */
  months: number[];
  niches: string[];
}

export interface Niche {
  name: string;
  designs: number;
  sold90: number;
  hitRate: number;
  u90: number;
  u30: number;
  prev60: number;
  r90: number;
  perDesign: number;
  verdict: 'double-down' | 'keep' | 'stop' | 'rising';
  examples: string[];
}

export type RecKind = 'replace' | 'weak' | 'add-types' | 'add-markets' | 'rising' | 'fading' | 'season' | 'niche-more' | 'niche-stop' | 'returns' | 'price' | 'mix';

export interface Recommendation {
  id: string;
  kind: RecKind;
  priority: 1 | 2 | 3;
  title: string;
  why: string;
  impact?: string;
  designs: Design[];
  /** Per-design detail line, e.g. the product types to add. */
  detail?: Record<string, string>;
  niche?: string;
}

export interface Portfolio {
  catalogKnown: boolean;
  designs: Design[];
  liveDesigns: number;
  liveProducts: number;
  designLimit: number | null;
  sold30: number;
  sold90: number;
  hitRate90: number;
  units30: number;
  units90: number;
  units365: number;
  royalty30: number;
  royalty90: number;
  royalty365: number;
  statusCounts: Record<string, number>;
  typeMix: Array<{ type: ProductType; listings: number; units90: number; royalty90: number; perListing: number }>;
  marketMix: Array<{ marketplace: MarketplaceId; units90: number; royalty90: number; listings: number }>;
  niches: Niche[];
  seasons: Array<UpcomingSeason & { designs: number; lastYearUnits: number | null }>;
  recommendations: Recommendation[];
}

// ---------- titles, designs, niches ----------

const TYPE_WORDS = /\b(?:premium|standard|t[\s-]?shirts?|tees?|shirts?|tshirts?|pullover|zip(?:per)?|hoodies?|hoody|sweatshirts?|long[\s-]?sleeves?|raglans?|v[\s-]?necks?|tank[\s-]?tops?|tanks?|popsockets?|popgrips?|grips?|phone[\s-]?cases?|cases?|tote[\s-]?bags?|totes?|throw[\s-]?pillows?|pillows?)\b/g;

export function designTitleKey(title: string): string {
  return fold(title).replace(TYPE_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

const GENERIC = new Set(
  `a an and are as at be but by for from has have i if in into is it its me my of on or our so that the their them this to too up
  us was we what when who will with you your yours not no just like love loves loving life day days year years
  funny cute cool vintage retro awesome best novelty graphic gift gifts present men women mens womens man woman boys boy girls
  girl kids kid toddler youth adult adults apparel clothing outfit costume design designs style idea ideas lover lovers fan fans
  matching family team squad crew club gang official saying sayings quote quotes humor humorous sarcastic sarcasm joke jokes
  pun puns classic distressed aesthetic trendy unisex perfect great gear merch tee shirt t shirts tees premium hoodie sweatshirt
  long sleeve tank top raglan pullover zip popsockets grip phone case tote bag throw pillow one only all more most very really
  every any some get got make made being been do does did im youre dont cant its thats`
    .split(/\s+/)
    .filter(Boolean),
);

function nicheTerms(title: string): string[] {
  const words = designTitleKey(title).split(' ').filter((w) => w.length > 1 && !/^\d+$/.test(w));
  const terms = new Set<string>();
  words.forEach((w, i) => {
    if (!GENERIC.has(w) && w.length > 2) terms.add(w);
    const next = words[i + 1];
    if (next && !GENERIC.has(w) && !GENERIC.has(next)) terms.add(`${w} ${next}`);
  });
  return Array.from(terms);
}

// ---------- building the portfolio ----------

const APPAREL: ProductType[] = ['STANDARD_TSHIRT', 'PREMIUM_TSHIRT', 'HOODIE', 'SWEATSHIRT', 'LONG_SLEEVE', 'VNECK', 'RAGLAN', 'TANK', 'ZIP_HOODIE'];

function emptyStat(key: string): ProductStat {
  return {
    key, asin: null, marketplace: null, productType: null, status: 'unknown', price: null,
    u30: 0, u90: 0, u365: 0, prev60: 0, r30: 0, r90: 0, r365: 0, returns365: 0, cancels365: 0, lastSale: null, firstSale: null,
  };
}

export function analyzePortfolio(input: AgentInput): Portfolio {
  const { today, currency, fx } = input;
  const d30 = addDays(today, -29);
  const d90 = addDays(today, -89);
  const d365 = addDays(today, -364);
  const catalogKnown = input.catalog.length > 0;

  // Products: catalog first, then anything that sold but isn't in the catalog.
  const products = new Map<string, ProductStat>();
  const titleOf = new Map<string, string>();
  const brandOf = new Map<string, string>();
  const designOf = new Map<string, string>();
  const createdOf = new Map<string, string | null>();
  const monthsOf = new Map<string, number[]>();

  const productKeyFor = (mp: MarketplaceId | null, asin: string | null, fallback: string) => (asin ? `${mp ?? 'XX'}:${asin}` : fallback);

  for (const item of input.catalog) {
    const key = productKeyFor(item.marketplace, item.asin, item.key);
    const stat = products.get(key) ?? emptyStat(key);
    stat.asin = item.asin;
    stat.marketplace = item.marketplace;
    stat.productType = item.productType;
    stat.status = item.status;
    stat.price = item.price;
    products.set(key, stat);
    titleOf.set(key, item.title);
    brandOf.set(key, item.brand);
    createdOf.set(key, item.createdAt);
    designOf.set(key, item.designId ? `d:${item.designId}` : `t:${designTitleKey(item.title)}`);
  }
  // Catalog items without a marketplace match sales from any marketplace by ASIN.
  const byAsin = new Map<string, string>();
  for (const [key, stat] of products) if (stat.asin) byAsin.set(stat.asin, key);

  for (const row of input.sales) {
    let key = `${row.marketplace}:${row.asin}`;
    if (!products.has(key)) {
      const viaAsin = byAsin.get(row.asin);
      if (viaAsin && products.get(viaAsin)!.marketplace === null) key = viaAsin;
    }
    let stat = products.get(key);
    if (!stat) {
      stat = { ...emptyStat(key), asin: row.asin, marketplace: row.marketplace, productType: row.productType, status: catalogKnown ? 'unknown' : 'live' };
      products.set(key, stat);
      titleOf.set(key, row.title);
      designOf.set(key, `t:${designTitleKey(row.title || row.asin)}`);
    }
    if (!titleOf.get(key) && row.title) titleOf.set(key, row.title);
    if (!stat.productType && row.productType) stat.productType = row.productType;
    const royalty = convert(row.royalty, row.currency, currency, fx);
    if (row.units > 0) {
      if (!stat.lastSale || rowEnd(row) > stat.lastSale) stat.lastSale = rowEnd(row);
      if (!stat.firstSale || row.date < stat.firstSale) stat.firstSale = row.date;
    }
    // Older history comes as monthly totals: count the share of each that falls in a window.
    const k30 = share(row, d30, today);
    const k90 = share(row, d90, today);
    const k365 = share(row, d365, today);
    stat.u30 += row.units * k30; stat.r30 += royalty * k30;
    stat.u90 += row.units * k90; stat.r90 += royalty * k90;
    stat.prev60 += row.units * share(row, d90, addDays(d30, -1));
    if (k365 > 0) {
      stat.u365 += row.units * k365;
      stat.r365 += royalty * k365;
      stat.returns365 += row.returned * k365;
      stat.cancels365 += row.cancelled * k365;
      const months = monthsOf.get(key) ?? new Array<number>(12).fill(0);
      months[Number(row.date.slice(5, 7)) - 1]! += row.units * k365;
      monthsOf.set(key, months);
    }
  }

  // Reports without daily rows: fill the windows the daily data doesn't cover.
  for (const total of input.totals) {
    const key = products.has(`${total.marketplace}:${total.asin}`) ? `${total.marketplace}:${total.asin}` : byAsin.get(total.asin) ?? `${total.marketplace}:${total.asin}`;
    let stat = products.get(key);
    if (!stat) {
      stat = { ...emptyStat(key), asin: total.asin, marketplace: total.marketplace, productType: total.productType, status: catalogKnown ? 'unknown' : 'live' };
      products.set(key, stat);
      titleOf.set(key, total.title);
      designOf.set(key, `t:${designTitleKey(total.title || total.asin)}`);
    }
    const covered = input.coverageFrom !== null && input.coverageFrom <= addDays(today, -(total.days - 1));
    if (covered) continue;
    const royalty = convert(total.royalty, total.currency, currency, fx);
    if (total.days >= 365) { stat.u365 = Math.max(stat.u365, total.units); stat.r365 = Math.max(stat.r365, royalty); }
    else if (total.days >= 90) { stat.u90 = Math.max(stat.u90, total.units); stat.r90 = Math.max(stat.r90, royalty); }
    else if (total.days >= 30) { stat.u30 = Math.max(stat.u30, total.units); stat.r30 = Math.max(stat.r30, royalty); }
    if (total.units > 0 && !stat.lastSale && total.days <= 30) stat.lastSale = today;
  }

  // Designs
  const designs = new Map<string, Design>();
  for (const [key, stat] of products) {
    const dk = designOf.get(key) ?? `t:${key}`;
    let d = designs.get(dk);
    if (!d) {
      d = {
        key: dk, title: titleOf.get(key) ?? '', brand: brandOf.get(key) ?? '', products: [], types: [], marketplaces: [],
        live: false, createdAt: null, ageDays: null, u30: 0, u90: 0, u365: 0, prev60: 0, r30: 0, r90: 0, r365: 0,
        returns365: 0, cancels365: 0, lastSale: null, months: new Array<number>(12).fill(0), niches: [],
      };
      designs.set(dk, d);
    }
    d.products.push(stat);
    if (!d.title && titleOf.get(key)) d.title = titleOf.get(key)!;
    if (!d.brand && brandOf.get(key)) d.brand = brandOf.get(key)!;
    const live = stat.status === 'live' || (stat.status === 'unknown' && !catalogKnown);
    if (live) {
      d.live = true;
      if (stat.productType && !d.types.includes(stat.productType)) d.types.push(stat.productType);
      if (stat.marketplace && !d.marketplaces.includes(stat.marketplace)) d.marketplaces.push(stat.marketplace);
    }
    const created = createdOf.get(key) ?? stat.firstSale;
    if (created && (!d.createdAt || created < d.createdAt)) d.createdAt = created;
    d.u30 += stat.u30; d.u90 += stat.u90; d.u365 += stat.u365; d.prev60 += stat.prev60;
    d.r30 += stat.r30; d.r90 += stat.r90; d.r365 += stat.r365;
    d.returns365 += stat.returns365; d.cancels365 += stat.cancels365;
    if (stat.lastSale && (!d.lastSale || stat.lastSale > d.lastSale)) d.lastSale = stat.lastSale;
    const months = monthsOf.get(key);
    if (months) months.forEach((n, i) => (d!.months[i]! += n));
  }
  const list = Array.from(designs.values());
  for (const d of list) {
    d.ageDays = d.createdAt ? daysBetween(d.createdAt, today) : null;
    d.niches = nicheTerms(d.title);
  }

  const liveDesigns = list.filter((d) => d.live);
  const liveProducts = Array.from(products.values()).filter((p) => p.status === 'live').length;
  const sold30 = liveDesigns.filter((d) => d.u30 > 0).length;
  const sold90 = liveDesigns.filter((d) => d.u90 > 0).length;
  const sum = (f: (d: Design) => number) => list.reduce((s, d) => s + f(d), 0);
  const statusCounts: Record<string, number> = {};
  for (const item of input.catalog) statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;

  const portfolio: Portfolio = {
    catalogKnown,
    designs: list,
    liveDesigns: liveDesigns.length,
    liveProducts: catalogKnown ? liveProducts : Array.from(products.values()).filter((p) => p.u365 > 0).length,
    designLimit: input.designLimit,
    sold30,
    sold90,
    hitRate90: liveDesigns.length ? sold90 / liveDesigns.length : 0,
    units30: sum((d) => d.u30),
    units90: sum((d) => d.u90),
    units365: sum((d) => d.u365),
    royalty30: sum((d) => d.r30),
    royalty90: sum((d) => d.r90),
    royalty365: sum((d) => d.r365),
    statusCounts,
    typeMix: typeMix(products),
    marketMix: marketMix(products),
    niches: niches(liveDesigns),
    seasons: seasons(liveDesigns, input),
    recommendations: [],
  };
  portfolio.recommendations = recommend(portfolio, input);
  return portfolio;
}

function typeMix(products: Map<string, ProductStat>): Portfolio['typeMix'] {
  const map = new Map<ProductType, { listings: number; units90: number; royalty90: number }>();
  for (const p of products.values()) {
    if (!p.productType) continue;
    const m = map.get(p.productType) ?? { listings: 0, units90: 0, royalty90: 0 };
    if (p.status === 'live' || p.status === 'unknown') m.listings += 1;
    m.units90 += p.u90;
    m.royalty90 += p.r90;
    map.set(p.productType, m);
  }
  return Array.from(map.entries())
    .map(([type, m]) => ({ type, ...m, perListing: m.listings ? m.royalty90 / m.listings : 0 }))
    .sort((a, b) => b.royalty90 - a.royalty90);
}

function marketMix(products: Map<string, ProductStat>): Portfolio['marketMix'] {
  const map = new Map<MarketplaceId, { units90: number; royalty90: number; listings: number }>();
  for (const p of products.values()) {
    if (!p.marketplace) continue;
    const m = map.get(p.marketplace) ?? { units90: 0, royalty90: 0, listings: 0 };
    m.units90 += p.u90;
    m.royalty90 += p.r90;
    if (p.status === 'live') m.listings += 1;
    map.set(p.marketplace, m);
  }
  return Array.from(map.entries()).map(([marketplace, m]) => ({ marketplace, ...m })).sort((a, b) => b.units90 - a.units90);
}

function niches(designs: Design[]): Niche[] {
  if (designs.length < 6) return [];
  const minDesigns = designs.length >= 60 ? 3 : 2;
  const groups = new Map<string, Design[]>();
  for (const d of designs) for (const term of d.niches) {
    const g = groups.get(term) ?? [];
    g.push(d);
    groups.set(term, g);
  }
  const baseRate = designs.filter((d) => d.u90 > 0).length / designs.length;
  const basePer = designs.reduce((s, d) => s + d.u90, 0) / designs.length;
  const out: Niche[] = [];
  for (const [name, group] of groups) {
    if (group.length < minDesigns || group.length === designs.length) continue;
    const sold = group.filter((d) => d.u90 > 0).length;
    const u90 = group.reduce((s, d) => s + d.u90, 0);
    const u30 = group.reduce((s, d) => s + d.u30, 0);
    const prev60 = group.reduce((s, d) => s + d.prev60, 0);
    const r90 = group.reduce((s, d) => s + d.r90, 0);
    const hitRate = sold / group.length;
    const perDesign = u90 / group.length;
    let verdict: Niche['verdict'] = 'keep';
    if (perDesign >= Math.max(1, basePer * 1.5) && hitRate >= baseRate) verdict = 'double-down';
    else if (u30 >= 3 && u30 >= prev60) verdict = 'rising';
    else if (group.length >= 6 && hitRate <= baseRate * 0.5 && perDesign <= basePer * 0.3) verdict = 'stop';
    out.push({
      name, designs: group.length, sold90: sold, hitRate, u90, u30, prev60, r90, perDesign, verdict,
      examples: [...group].sort((a, b) => b.u90 - a.u90).slice(0, 3).map((d) => d.title),
    });
  }
  // Words that always appear together ("fishing", "lure", "fishing lure")
  // describe one niche: keep a single name per set of designs, preferring
  // the more descriptive phrase.
  const members = new Map<string, Set<string>>();
  for (const [name, group] of groups) members.set(name, new Set(group.map((d) => d.key)));
  const overlap = (a: string, b: string) => {
    const A = members.get(a)!;
    const B = members.get(b)!;
    let both = 0;
    for (const k of A) if (B.has(k)) both += 1;
    return both / (A.size + B.size - both);
  };
  out.sort((a, b) => b.r90 - a.r90 || b.designs - a.designs || b.name.split(' ').length - a.name.split(' ').length || a.name.localeCompare(b.name));
  const kept: Niche[] = [];
  for (const n of out) {
    const dup = kept.findIndex((k) => overlap(k.name, n.name) >= 0.85);
    if (dup === -1) kept.push(n);
    else if (n.name.split(' ').length > kept[dup]!.name.split(' ').length && n.designs >= kept[dup]!.designs) kept[dup] = n;
    if (kept.length >= 40) break;
  }
  return kept;
}

function seasons(designs: Design[], input: AgentInput): Portfolio['seasons'] {
  return upcomingSeasons(input.today, 100).map((u) => {
    const matching = designs.filter((d) => u.season.keywords.test(` ${fold(d.title)} `));
    // Units sold in the same selling window last year, if daily history reaches back that far.
    const lastFrom = addDays(u.sellingFrom, -364);
    const lastTo = addDays(u.date, -364);
    const covered = input.coverageFrom !== null && input.coverageFrom <= lastFrom;
    let lastYearUnits: number | null = null;
    if (covered) {
      lastYearUnits = 0;
      const keys = new Set(matching.flatMap((d) => d.products.map((p) => p.key)));
      for (const row of input.sales) {
        if (keys.has(`${row.marketplace}:${row.asin}`)) lastYearUnits += row.units * share(row, lastFrom, lastTo);
      }
    }
    return { ...u, designs: matching.length, lastYearUnits };
  });
}

// ---------- recommendations ----------

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function recommend(p: Portfolio, input: AgentInput): Recommendation[] {
  const recs: Recommendation[] = [];
  const live = p.designs.filter((d) => d.live);
  const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: input.currency, maximumFractionDigits: input.currency === 'JPY' ? 0 : 0 }).format(n);
  const historyDays = input.coverageFrom ? daysBetween(input.coverageFrom, input.today) + 1 : 0;
  // How many days of sales Loupe can vouch for: daily history or product totals.
  const knownDays = Math.min(365, Math.max(historyDays, ...input.totals.map((t) => t.days), 0));
  const nearLimit = p.designLimit ? p.liveDesigns >= p.designLimit * 0.9 : false;

  // 1. Dead designs: free the slot for something new. Only when Loupe has
  // enough sales history to be sure, so a failed sales sync never marks
  // the whole catalog as dead.
  if (p.catalogKnown && knownDays >= 120 && p.units365 > 0) {
    const window = knownDays;
    // Seasonal designs sell a few weeks a year; without a full year of
    // history their quiet months look like death.
    const seasonal = (d: Design) => window < 365 && SEASONS.some((s) => s.keywords.test(` ${fold(d.title)} `));
    const skippedSeasonal = live.filter((d) => d.u365 === 0 && d.u90 === 0 && seasonal(d)).length;
    const dead = live
      .filter((d) => d.u365 === 0 && d.u90 === 0 && (d.ageDays ?? 0) >= 120 && !seasonal(d))
      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
    if (dead.length) {
      recs.push({
        id: 'replace',
        kind: 'replace',
        priority: nearLimit || dead.length >= 20 ? 1 : 2,
        title: `Replace ${dead.length.toLocaleString()} designs with no sales ${window >= 365 ? 'in the past year' : `in ${window} days`}`,
        why: `Each is at least 4 months old and has no sales in the last ${window >= 365 ? 'year' : `${window} days`} (or since it went live). Merch removes listings after long periods without sales anyway; replacing them now gives those slots to designs that can sell.${skippedSeasonal ? ` ${skippedSeasonal} seasonal designs are left out until Loupe has a full year of sales history.` : ''}`,
        impact: p.designLimit ? `Frees ${dead.length.toLocaleString()} of your ${p.designLimit.toLocaleString()} design slots${nearLimit ? ' (you are near your limit)' : ''}.` : `Frees ${dead.length.toLocaleString()} design slots.`,
        designs: dead,
      });
    }
    const weak = live
      .filter((d) => d.u365 > 0 && d.u365 <= 2 && d.u90 === 0 && (d.ageDays ?? 0) >= 240)
      .sort((a, b) => a.u365 - b.u365 || (b.ageDays ?? 0) - (a.ageDays ?? 0));
    if (weak.length) {
      recs.push({
        id: 'weak',
        kind: 'weak',
        priority: nearLimit ? 2 : 3,
        title: `${weak.length.toLocaleString()} designs sell once or twice a year`,
        why: 'Older than 8 months, 1–2 sales in the last year and none in 90 days. Next in line to replace once the dead designs are gone.',
        designs: weak,
      });
    }
  }

  // 2. Winners: add product types and marketplaces.
  const sellers = live.filter((d) => d.u90 > 0);
  const winnerCut = Math.max(3, percentile(sellers.map((d) => d.u90), 0.8));
  const winners = sellers.filter((d) => d.u90 >= winnerCut).sort((a, b) => b.r90 - a.r90);
  const typeRank = p.typeMix.filter((t) => APPAREL.includes(t.type)).sort((a, b) => b.perListing - a.perListing).map((t) => t.type);
  const preferred = [...typeRank, ...APPAREL.filter((t) => !typeRank.includes(t))];
  if (winners.length) {
    const detail: Record<string, string> = {};
    const missingTypes = winners.filter((d) => {
      const missing = preferred.filter((t) => !d.types.includes(t)).slice(0, 3);
      if (missing.length && d.types.length < 6) detail[d.key] = `Add ${missing.map((t) => PRODUCT_TYPES[t].short).join(', ')}`;
      return missing.length && d.types.length < 6;
    });
    if (missingTypes.length) {
      recs.push({
        id: 'add-types',
        kind: 'add-types',
        priority: 1,
        title: `Put your ${missingTypes.length} best sellers on more products`,
        why: `These designs sold at least ${winnerCut} units in 90 days but are listed on few product types${p.catalogKnown ? '' : ' (based on the types that sold)'}. Buyers who like a design often want it as a hoodie or sweatshirt too.`,
        impact: `They earned ${money(missingTypes.reduce((s, d) => s + d.r90, 0))} in 90 days on their current products.`,
        designs: missingTypes,
        detail,
      });
    }
    if (p.catalogKnown) {
      const mdetail: Record<string, string> = {};
      const missingMarkets = winners.filter((d) => {
        const missing = MARKETPLACE_IDS.filter((m) => !d.marketplaces.includes(m));
        if (missing.length && d.marketplaces.length) mdetail[d.key] = `Not in ${missing.map((m) => MARKETPLACES[m].flag).join(' ')}`;
        return missing.length && d.marketplaces.length > 0 && d.marketplaces.length < 4;
      });
      if (missingMarkets.length) {
        recs.push({
          id: 'add-markets',
          kind: 'add-markets',
          priority: 2,
          title: `List ${missingMarkets.length} best sellers in Europe and Japan`,
          why: 'They sell in the marketplaces they are in but are missing from others. Merch can publish the same design to the UK, Germany, France, Italy, Spain and Japan.',
          designs: missingMarkets,
          detail: mdetail,
        });
      }
    }
  }

  // 3. Momentum
  const rising = live
    .filter((d) => d.u30 >= 3 && d.u30 >= 2 * Math.max(1, d.prev60 / 2))
    .sort((a, b) => b.u30 - a.u30);
  if (rising.length) {
    recs.push({
      id: 'rising',
      kind: 'rising',
      priority: 1,
      title: `${rising.length} designs are taking off`,
      why: 'They sold at least twice as many units in the last 30 days as in a typical month before. Momentum is the best time to make variations of the idea and to add ads.',
      designs: rising,
      detail: Object.fromEntries(rising.map((d) => [d.key, `${d.u30} in 30 days vs ${Math.round(d.prev60 / 2)} per month before`])),
    });
  }
  const fading = live
    .filter((d) => d.prev60 / 2 >= 4 && d.u30 <= 0.4 * (d.prev60 / 2))
    .sort((a, b) => b.prev60 - a.prev60);
  if (fading.length) {
    recs.push({
      id: 'fading',
      kind: 'fading',
      priority: 2,
      title: `${fading.length} former winners are slowing down`,
      why: 'They sold well 1–3 months ago but less than half as much in the last 30 days. Check their BSR and competitors; a refreshed version or a seasonal angle can bring them back.',
      designs: fading,
      detail: Object.fromEntries(fading.map((d) => [d.key, `${d.u30} in 30 days vs ${Math.round(d.prev60 / 2)} per month before`])),
    });
  }

  // 4. Seasons
  for (const s of p.seasons.slice(0, 3)) {
    const matching = live.filter((d) => s.season.keywords.test(` ${fold(d.title)} `)).sort((a, b) => b.u365 - a.u365);
    const days = s.daysUntil;
    const open = daysBetween(s.sellingFrom, input.today) >= 0;
    recs.push({
      id: `season-${s.season.id}-${s.date}`,
      kind: 'season',
      priority: days <= 60 ? 1 : 2,
      title: `${s.season.name} is in ${days} days: ${matching.length ? `you have ${matching.length} designs for it` : 'you have no designs for it yet'}`,
      why: open
        ? `Shoppers are buying now (from ${s.sellingFrom}). New designs uploaded today still have time to get indexed.`
        : `Shoppers start buying around ${s.sellingFrom}. Upload new designs by ${s.uploadBy} so they're indexed in time.`,
      impact: s.lastYearUnits !== null && matching.length ? `Last year these designs sold ${s.lastYearUnits.toLocaleString()} units in the same window.` : undefined,
      designs: matching.slice(0, 50),
    });
  }

  // 5. Niches
  const more = p.niches.filter((n) => n.verdict === 'double-down' || n.verdict === 'rising').slice(0, 8);
  if (more.length) {
    recs.push({
      id: 'niche-more',
      kind: 'niche-more',
      priority: 1,
      title: `Make more designs in ${more.slice(0, 3).map((n) => `“${n.name}”`).join(', ')}${more.length > 3 ? ` and ${more.length - 3} more niches` : ''}`,
      why: `These niches sell ${more[0] ? `${more[0].perDesign.toFixed(1)} units per design` : 'above average'} in 90 days with most designs selling, well above your account average. New angles in proven niches are your highest-odds uploads.`,
      designs: [],
      niche: more.map((n) => n.name).join('|'),
    });
  }
  const stop = p.niches.filter((n) => n.verdict === 'stop').slice(0, 8);
  if (stop.length) {
    recs.push({
      id: 'niche-stop',
      kind: 'niche-stop',
      priority: 2,
      title: `Stop uploading to ${stop.slice(0, 3).map((n) => `“${n.name}”`).join(', ')}`,
      why: 'You have many designs in these niches and few of them sell. Put those uploads into the niches above instead.',
      designs: [],
      niche: stop.map((n) => n.name).join('|'),
    });
  }

  // 6. Returns and cancellations
  const returns = live
    .filter((d) => d.u365 >= 5 && (d.returns365 + d.cancels365) / d.u365 >= 0.2)
    .sort((a, b) => (b.returns365 + b.cancels365) / b.u365 - (a.returns365 + a.cancels365) / a.u365);
  if (returns.length) {
    recs.push({
      id: 'returns',
      kind: 'returns',
      priority: 3,
      title: `${returns.length} designs have a high return or cancellation rate`,
      why: 'At least 1 in 5 orders came back or was cancelled. Check print size, colors and whether the title promises something the shirt doesn’t deliver.',
      designs: returns,
      detail: Object.fromEntries(returns.map((d) => [d.key, `${Math.round(((d.returns365 + d.cancels365) / d.u365) * 100)}% of ${d.u365} orders`])),
    });
  }

  // 7. Price tests on strong sellers
  const model = input.royalty ?? DEFAULT_ROYALTY_MODEL;
  const tier = input.tier ?? 'creator';
  const strong = live.filter((d) => d.u30 >= 10).sort((a, b) => b.u30 - a.u30);
  if (strong.length) {
    const perDollar = (1 - model.referralRate) * model.creatorShare * model.tierMultipliers[tier];
    recs.push({
      id: 'price',
      kind: 'price',
      priority: 3,
      title: `Test a higher price on your ${strong.length} fastest sellers`,
      why: `Each +$1 on a US tee adds about $${perDollar.toFixed(2)} royalty per sale at your tier. Designs selling 10+ a month usually keep most of their volume at +$1–2. Change one at a time and compare 2 weeks before and after.`,
      impact: `At +$2 with no volume change: about ${money(strong.reduce((s, d) => s + d.u30, 0) * 2 * perDollar)} more per month.`,
      designs: strong,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

