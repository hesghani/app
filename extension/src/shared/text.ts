// Text and number helpers shared by every parser. Amazon pages sprinkle
// invisible direction marks (U+200E/U+200F) and odd spaces through their
// product details, so everything goes through clean() first.

const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;
const SPACES = /[\s   ]+/g;

export function clean(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(INVISIBLE, '').replace(SPACES, ' ').trim();
}

/** Lowercase, accent-free, punctuation-free form used for matching. */
export function fold(text: string): string {
  return clean(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Parses an integer written with any thousands separator: "1,234", "1.234", "1 234". */
export function parseInteger(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a price such as "$19.99", "19,99 €", "£1,299.00" or "￥2,980".
 * A separator followed by exactly two trailing digits is the decimal point.
 */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = clean(text).match(/\d[\d.,\s  ]*/);
  if (!match) return null;
  const raw = match[0].replace(/[\s  ]/g, '').replace(/[.,]$/, '');
  const lastSep = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  if (lastSep === -1) return Number(raw);
  const decimals = raw.length - lastSep - 1;
  if (decimals === 2 || decimals === 1) {
    const whole = raw.slice(0, lastSep).replace(/[.,]/g, '');
    return Number(`${whole}.${raw.slice(lastSep + 1)}`);
  }
  return Number(raw.replace(/[.,]/g, ''));
}

/** Parses a rating like "4.6 out of 5 stars" or "4,6 von 5 Sternen". */
export function parseRating(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = clean(text).match(/(\d)[.,](\d)/) ?? clean(text).match(/\b([1-5])\b/);
  if (!m) return null;
  const value = m[2] !== undefined ? Number(`${m[1]}.${m[2]}`) : Number(m[1]);
  return value >= 0 && value <= 5 ? value : null;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
