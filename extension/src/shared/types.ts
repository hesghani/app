import type { Currency, MarketplaceId } from './marketplaces';
import type { ProductType } from './products';

export interface RankEntry { rank: number; category: string }

export type MerchVerdict = 'yes' | 'likely' | 'no';

/** Everything Loupe reads off an Amazon product page. */
export interface ProductData {
  asin: string;
  marketplace: MarketplaceId;
  title: string;
  brand: string;
  price: number | null;
  currency: Currency;
  rating: number | null;
  reviews: number | null;
  /** Rank in the top-level category (the number that drives sales estimates). */
  bsr: number | null;
  bsrCategory: string | null;
  subRanks: RankEntry[];
  /** "Date First Available", ISO YYYY-MM-DD. */
  firstAvailable: string | null;
  bullets: string[];
  description: string;
  merch: MerchVerdict;
  productType: ProductType | null;
  image: string | null;
  soldByAmazon: boolean;
  fetchedAt: number;
}

/** A product in the local cache, with its BSR history. */
export interface StoredProduct extends ProductData {
  /** [timestamp, bsr] pairs, oldest first. */
  history: Array<[number, number]>;
  tracked?: boolean;
  trackedAt?: number;
  note?: string;
}

export interface SaleRow {
  /** Calendar date of the sale, YYYY-MM-DD. */
  date: string;
  marketplace: MarketplaceId;
  asin: string;
  productType: ProductType | null;
  title: string;
  units: number;
  cancelled: number;
  returned: number;
  /** Royalty in the marketplace currency. */
  royalty: number;
  currency: Currency;
  source: 'capture' | 'csv' | 'demo';
}

export interface ListingDraft {
  id: string;
  name: string;
  brand: string;
  title: string;
  bullet1: string;
  bullet2: string;
  description: string;
  keywords: string;
  updatedAt: number;
}

export interface CaptureLogEntry {
  path: string;
  at: number;
  rows: number;
  status: number;
  keys: string[];
  /** Redacted request description: parameter names and value kinds only. */
  request?: string;
  kind?: 'sales' | 'catalog' | 'none';
  items?: number;
  template?: boolean;
}

export interface NicheResult {
  keyword: string;
  marketplace: MarketplaceId;
  analyzedAt: number;
  totalResults: number | null;
  sampled: number;
  medianBsr: number | null;
  under100k: number;
  avgMonthlySales: number;
  medianAgeDays: number | null;
  avgReviews: number | null;
  score: number;
  top: Array<Pick<ProductData, 'asin' | 'title' | 'bsr' | 'firstAvailable' | 'price' | 'reviews' | 'image'>>;
}

export type CatalogStatus = 'live' | 'review' | 'processing' | 'rejected' | 'draft' | 'removed' | 'other';

/** One listing from the Merch catalog (one product type in one marketplace). */
export interface CatalogItem {
  key: string;
  asin: string | null;
  /** Merch's own id for the product or listing, when it has one. */
  id: string | null;
  designId: string | null;
  title: string;
  brand: string;
  productType: ProductType | null;
  marketplace: MarketplaceId | null;
  status: CatalogStatus;
  rawStatus: string;
  price: number | null;
  /** When the listing was created or published, YYYY-MM-DD. */
  createdAt: string | null;
  image: string | null;
  seenAt: number;
}

/** Sales for one product over a window, for reports that don't break sales down by day. */
export interface RangeTotal {
  key: string;
  days: number;
  to: string;
  marketplace: MarketplaceId;
  asin: string;
  title: string;
  productType: ProductType | null;
  units: number;
  cancelled: number;
  returned: number;
  royalty: number;
  currency: Currency;
  fetchedAt: number;
}

export type SyncMode = 'connect' | 'full' | 'quick';

export interface SyncState {
  status: 'idle' | 'running' | 'done' | 'partial' | 'error' | 'signin';
  mode: SyncMode;
  phase: string;
  progress?: { done: number; total: number };
  startedAt?: number;
  finishedAt?: number;
  tabId?: number;
  openedTab?: boolean;
  visited?: string[];
  stats?: { salesRows: number; catalogItems: number; requests: number; errors: number };
  error?: string;
}

/** Numbers about the account (tier, limits) found in Merch's responses. */
export interface AccountFacts {
  tier?: number;
  facts: Record<string, number>;
  seenAt: number;
}
