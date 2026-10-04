// Keyword extraction from listings, and Amazon's search-suggestion API for
// keyword research.

import { MARKETPLACES, type MarketplaceId } from './marketplaces';
import { fold } from './text';

const STOPWORDS = new Set(
  `a an and are as at be but by for from has have i if in into is it its me my of on or our so that the their them
  this to too up us was we what when who will with you your yours der die das und ein eine für mit von zu im ist le la
  les des du un une et pour avec en il lo gli una per con di da el los las y para por que del al`
    .split(/\s+/)
    .filter(Boolean),
);

// Words that describe the product rather than the design.
const PRODUCT_WORDS = new Set(
  `shirt shirts tshirt t tee tees hoodie hoodies sweatshirt sweatshirts tank top long sleeve raglan vneck v neck
  premium standard men mens women womens kids boys girls youth unisex adult funny gift gifts present design novelty
  graphic cute cool vintage retro lightweight classic fit double needle sleeve bottom hem solid colors cotton heather
  grey polyester heathers all other popsockets grip phone case tote bag throw pillow`
    .split(/\s+/)
    .filter(Boolean),
);

export interface KeywordScore { phrase: string; score: number; count: number }

// Bullets Amazon adds to every Merch listing; they say nothing about the design.
const STOCK_BULLET = /^(?:solid colors|imported|machine wash|lightweight, classic fit|8\.5 oz|this premium t-shirt|unifarben|importiert|maschinenwäsche|leicht, klassisch|couleurs unies|importé|lavable en machine|tinta unita|importato|lavabile in lavatrice|colores sólidos|importado|lavar a máquina)/i;

export function isStockBullet(text: string): boolean {
  return STOCK_BULLET.test(text.trim());
}

/** Numbers only count when they look like a year ("born in 1985"). */
function isNoiseNumber(word: string): boolean {
  return /^\d+$/.test(word) && !/^(?:19|20)\d\d$/.test(word);
}

/**
 * Ranks 1–3 word phrases from weighted texts (title counts triple, brand
 * double). Phrases made only of stopwords or product words are skipped.
 */
export function extractKeywords(
  sources: Array<{ text: string; weight: number }>,
  limit = 20,
): KeywordScore[] {
  const scores = new Map<string, KeywordScore>();
  for (const { text, weight } of sources) {
    if (isStockBullet(text)) continue;
    const words = fold(text).split(' ').filter((w) => w.length > 1 || /\d/.test(w));
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        if (STOPWORDS.has(gram[0]!) || STOPWORDS.has(gram[n - 1]!)) continue;
        if (gram.every((w) => PRODUCT_WORDS.has(w) || STOPWORDS.has(w))) continue;
        if (gram.some(isNoiseNumber)) continue;
        if (n === 1 && gram[0]!.length < 3) continue;
        const phrase = gram.join(' ');
        const current = scores.get(phrase) ?? { phrase, score: 0, count: 0 };
        current.score += weight * (1 + (n - 1) * 0.6);
        current.count += 1;
        scores.set(phrase, current);
      }
    }
  }
  const ranked = Array.from(scores.values()).sort((a, b) => b.score - a.score || b.phrase.length - a.phrase.length);
  // Drop single words already covered by a stronger longer phrase.
  return ranked
    .filter((k) => !ranked.some((o) => o !== k && o.score >= k.score && o.phrase.includes(' ') && ` ${o.phrase} `.includes(` ${k.phrase} `)))
    .slice(0, limit);
}

export type SuggestionAlias = 'aps' | 'fashion';

function suggestionHosts(mp: MarketplaceId): string[] {
  const own = `https://completion.${MARKETPLACES[mp].domain}`;
  if (mp === 'US' || mp === 'JP') return [own];
  return [own, 'https://completion.amazon.co.uk'];
}

/** Pulls suggestion strings out of both the 2017 API shape and the legacy array shape. */
export function parseSuggestions(json: unknown): string[] {
  if (Array.isArray(json) && Array.isArray(json[1])) {
    return (json[1] as unknown[]).filter((s): s is string => typeof s === 'string');
  }
  if (json && typeof json === 'object' && Array.isArray((json as { suggestions?: unknown }).suggestions)) {
    return ((json as { suggestions: Array<{ value?: unknown }> }).suggestions)
      .map((s) => (typeof s.value === 'string' ? s.value : ''))
      .filter(Boolean);
  }
  return [];
}

export async function fetchSuggestions(
  mp: MarketplaceId,
  prefix: string,
  alias: SuggestionAlias = 'aps',
  signal?: AbortSignal,
): Promise<string[]> {
  const params = new URLSearchParams({
    limit: '11',
    prefix,
    'suggestion-type': 'KEYWORD',
    'page-type': 'Search',
    alias,
    'site-variant': 'desktop',
    version: '3',
    event: 'onkeypress',
    wc: '',
    lop: MARKETPLACES[mp].locale.replace('-', '_'),
    'last-prefix': '',
    'avg-ks-time': '0',
    fb: '1',
    mid: MARKETPLACES[mp].mid,
    'plain-mid': '1',
    'client-info': 'amazon-search-ui',
  });
  let lastError: unknown = null;
  for (const host of suggestionHosts(mp)) {
    try {
      const res = await fetch(`${host}/api/2017/suggestions?${params.toString()}`, { signal, credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseSuggestions(await res.json());
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Suggestions unavailable');
}

export interface ExpandedKeyword { keyword: string; hits: number; bestPosition: number }

/**
 * "Alphabet soup" expansion: asks for suggestions for the seed, then the seed
 * followed by each letter, and ranks keywords by how often and how high Amazon
 * suggests them.
 */
export async function expandSeed(
  mp: MarketplaceId,
  seed: string,
  alias: SuggestionAlias,
  onProgress: (done: number, total: number, found: ExpandedKeyword[]) => void,
  signal?: AbortSignal,
): Promise<ExpandedKeyword[]> {
  const base = seed.trim().toLowerCase();
  const prefixes = [base, ...'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => `${base} ${l}`)];
  const found = new Map<string, ExpandedKeyword>();
  let done = 0;
  const sorted = () => Array.from(found.values()).sort((a, b) => b.hits - a.hits || a.bestPosition - b.bestPosition);

  const worker = async (queue: string[]) => {
    while (queue.length) {
      const prefix = queue.shift()!;
      try {
        const list = await fetchSuggestions(mp, prefix, alias, signal);
        list.forEach((keyword, position) => {
          const k = keyword.toLowerCase().trim();
          if (!k) return;
          const current = found.get(k) ?? { keyword: k, hits: 0, bestPosition: position };
          current.hits += 1;
          current.bestPosition = Math.min(current.bestPosition, position);
          found.set(k, current);
        });
      } catch (error) {
        if (signal?.aborted) throw error;
      }
      done += 1;
      onProgress(done, prefixes.length, sorted());
    }
  };
  const queue = [...prefixes];
  await Promise.all([worker(queue), worker(queue), worker(queue)]);
  return sorted();
}
