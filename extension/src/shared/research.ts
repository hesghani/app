// Fetching and parsing Amazon pages. Works anywhere DOMParser exists: content
// scripts (same-origin requests) and extension pages (cross-origin requests
// allowed by host permissions). The service worker uses the offscreen page.

import { origin, productUrl, type MarketplaceId } from './marketplaces';
import { isCaptchaPage, parseProductDocument } from './parse-product';
import { readCards, readResultCount, type SearchCard } from './parse-search';
import type { ProductData } from './types';

export class CaptchaError extends Error {
  constructor() {
    super('Amazon is showing a robot check. Open any Amazon page, solve it, then resume.');
    this.name = 'CaptchaError';
  }
}

export class HttpError extends Error {
  constructor(public status: number) {
    super(`Amazon answered HTTP ${status}`);
    this.name = 'HttpError';
  }
}

async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { credentials: 'include', signal, headers: { Accept: 'text/html' } });
  if (res.status === 503) throw new CaptchaError();
  if (!res.ok) throw new HttpError(res.status);
  const html = await res.text();
  if (isCaptchaPage(html)) throw new CaptchaError();
  return html;
}

/**
 * `sameOrigin` uses a relative URL so a content script's request goes to the
 * page's own host, which is the only cross-origin-safe option there.
 */
export async function fetchProduct(
  mp: MarketplaceId,
  asin: string,
  options: { signal?: AbortSignal; sameOrigin?: boolean } = {},
): Promise<ProductData> {
  const url = options.sameOrigin ? `/dp/${asin}?psc=1` : `${productUrl(mp, asin)}?psc=1`;
  const html = await fetchHtml(url, options.signal);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const data = parseProductDocument(doc, mp, asin);
  // Amazon sometimes redirects a child ASIN to its parent; keep the one we asked for.
  return { ...data, asin };
}

export interface SearchPage {
  url: string;
  totalResults: number | null;
  cards: Array<Omit<SearchCard, 'element'>>;
}

export async function fetchSearch(mp: MarketplaceId, url: string, signal?: AbortSignal): Promise<SearchPage> {
  const absolute = url.startsWith('http') ? url : `${origin(mp)}${url}`;
  const html = await fetchHtml(absolute, signal);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = readCards(doc).map(({ element: _element, ...card }) => card);
  return { url: absolute, totalResults: readResultCount(doc), cards };
}
