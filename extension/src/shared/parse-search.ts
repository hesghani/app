// Reads Amazon search result pages.

import { clean, parseInteger, parsePrice, parseRating } from './text';

export interface SearchCard {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  reviews: number | null;
  sponsored: boolean;
  image: string | null;
  element: HTMLElement;
}

export const CARD_SELECTOR = 'div[data-component-type="s-search-result"][data-asin]';

export function isSponsored(card: Element): boolean {
  return Boolean(
    card.classList.contains('AdHolder') ||
      card.querySelector('.puis-sponsored-label-text, .s-sponsored-label-text, [data-component-type="sp-sponsored-result"]') ||
      /\/sspa\/click/.test(card.querySelector('h2 a, a.a-link-normal')?.getAttribute('href') ?? ''),
  );
}

export function readCard(card: HTMLElement): SearchCard | null {
  const asin = (card.getAttribute('data-asin') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null;
  const title = clean(card.querySelector('h2')?.textContent);
  const price = parsePrice(card.querySelector('.a-price .a-offscreen')?.textContent);
  const ratingEl = card.querySelector('i[class*="a-star"] .a-icon-alt, span.a-icon-alt, [aria-label*="5"]');
  const rating = parseRating(ratingEl?.textContent || ratingEl?.getAttribute('aria-label'));
  const reviewsEl =
    card.querySelector('[aria-label$="ratings"], [aria-label$="rating"], a[href*="customerReviews"] span, span.a-size-base.s-underline-text');
  const reviews = parseInteger(reviewsEl?.getAttribute('aria-label') || reviewsEl?.textContent);
  const image = card.querySelector('img.s-image')?.getAttribute('src') ?? null;
  return { asin, title, price, rating, reviews, sponsored: isSponsored(card), image, element: card };
}

export function readCards(root: ParentNode): SearchCard[] {
  const seen = new Set<string>();
  const cards: SearchCard[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR))) {
    const card = readCard(el);
    if (card && !seen.has(card.asin)) {
      seen.add(card.asin);
      cards.push(card);
    }
  }
  return cards;
}

/**
 * "1-48 of over 50,000 results for", "1-48 von mehr als 50.000 Ergebnissen",
 * "1 à 48 sur plus de 50 000 résultats" → 50000.
 */
export function parseResultCount(text: string | null | undefined): number | null {
  const t = clean(text);
  if (!t) return null;
  const numbers = Array.from(t.matchAll(/\d{1,3}(?:[.,\s]\d{3})+|\d+/g)).map((m) => parseInteger(m[0]) ?? 0);
  if (!numbers.length) return null;
  return Math.max(...numbers);
}

export function readResultCount(doc: ParentNode): number | null {
  const el =
    doc.querySelector('[data-component-type="s-result-info-bar"] h1 span') ??
    doc.querySelector('.s-desktop-toolbar .a-section span') ??
    doc.querySelector('#search .s-breadcrumb span');
  return parseResultCount(el?.textContent);
}
