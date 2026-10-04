// Niche analysis: how much demand a keyword has (BSRs of the top results),
// how crowded it is (number of results), and how open it is to newcomers
// (how young the products that sell are). Combined into a 0–100 score.

import { salesPerMonth } from './bsr';
import { ageInDays } from './dates';
import { merchSearchUrl, type MarketplaceId } from './marketplaces';
import { fetchProduct, fetchSearch } from './research';
import { PoliteQueue } from './queue';
import type { NicheResult, ProductData } from './types';

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Scores 0–100. Each part is scaled on a log axis between "great" and "hopeless". */
export function nicheScore(input: { medianBsr: number | null; totalResults: number | null; medianAgeDays: number | null; under100kShare: number }): number {
  const demand = input.medianBsr
    ? clamp(((Math.log10(3_000_000) - Math.log10(input.medianBsr)) / (Math.log10(3_000_000) - Math.log10(20_000))) * 100)
    : 0;
  const competition = input.totalResults !== null
    ? clamp(((Math.log10(100_000) - Math.log10(Math.max(1, input.totalResults))) / (Math.log10(100_000) - Math.log10(200))) * 100)
    : 50;
  const freshness = input.medianAgeDays !== null ? clamp(100 - (input.medianAgeDays / 1095) * 100) : 50;
  const depth = input.under100kShare * 100;
  return Math.round(demand * 0.4 + depth * 0.15 + competition * 0.3 + freshness * 0.15);
}

export function summarizeNiche(
  keyword: string,
  mp: MarketplaceId,
  totalResults: number | null,
  products: ProductData[],
  now = Date.now(),
): NicheResult {
  const ranked = products.filter((p) => p.bsr);
  const bsrs = ranked.map((p) => p.bsr!);
  const ages = products.map((p) => ageInDays(p.firstAvailable, now)).filter((a): a is number => a !== null);
  const reviews = products.map((p) => p.reviews ?? 0);
  const under100k = bsrs.filter((b) => b <= 100_000).length;
  const medianBsr = median(bsrs);
  const medianAgeDays = median(ages);
  return {
    keyword,
    marketplace: mp,
    analyzedAt: now,
    totalResults,
    sampled: products.length,
    medianBsr,
    under100k,
    avgMonthlySales: ranked.length ? ranked.reduce((s, p) => s + (salesPerMonth(p.bsr, mp) ?? 0), 0) / ranked.length : 0,
    medianAgeDays,
    avgReviews: reviews.length ? reviews.reduce((a, b) => a + b, 0) / reviews.length : null,
    score: nicheScore({ medianBsr, totalResults, medianAgeDays, under100kShare: products.length ? under100k / products.length : 0 }),
    top: products.slice(0, 12).map(({ asin, title, bsr, firstAvailable, price, reviews: r, image }) => ({
      asin, title, bsr, firstAvailable, price, reviews: r, image,
    })),
  };
}

export async function analyzeNiche(
  keyword: string,
  mp: MarketplaceId,
  options: { sample?: number; template?: string; signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<NicheResult> {
  const page = await fetchSearch(mp, merchSearchUrl(mp, keyword, options.template), options.signal);
  const targets = page.cards.filter((c) => !c.sponsored).slice(0, options.sample ?? 12);
  const queue = new PoliteQueue({ concurrency: 2, minDelay: 300, maxDelay: 800 });
  let done = 0;
  options.onProgress?.(0, targets.length);
  const results = await Promise.all(
    targets.map((card) =>
      queue.add(async () => {
        try {
          return await fetchProduct(mp, card.asin, { signal: options.signal });
        } catch (error) {
          if ((error as Error).name === 'CaptchaError') {
            queue.clear();
            throw error;
          }
          return null;
        } finally {
          done += 1;
          options.onProgress?.(done, targets.length);
        }
      }),
    ),
  );
  return summarizeNiche(keyword, mp, page.totalResults, results.filter((p): p is ProductData => p !== null));
}
