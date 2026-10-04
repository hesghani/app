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
}

/** A GET request on merch.amazon.com that returned sales data and can be replayed. */
export interface ReplayTemplate {
  url: string;
  headers: Record<string, string>;
  capturedAt: number;
  rows: number;
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
