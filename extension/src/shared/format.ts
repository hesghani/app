import type { Currency } from './marketplaces';

const LOCALE = 'en-US';

export function money(value: number, currency: Currency, options: { compact?: boolean } = {}): string {
  const digits = currency === 'JPY' ? 0 : 2;
  if (options.compact && Math.abs(value) >= 10_000) {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function int(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return Math.round(value).toLocaleString(LOCALE);
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function bsr(value: number | null | undefined): string {
  return value ? `#${int(value)}` : '–';
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return `${(value * 100).toFixed(digits)}%`;
}

export function signedPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'new';
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function age(days: number | null | undefined): string {
  if (days === null || days === undefined) return '–';
  if (days < 1) return 'today';
  if (days < 60) return `${days}d`;
  if (days < 730) return `${Math.round(days / 30.4)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function day(iso: string | null | undefined, style: 'short' | 'long' = 'short'): string {
  if (!iso) return '–';
  const d = new Date(`${iso}T12:00:00Z`);
  // Short dates outside the current year (or the year around it) show the year.
  const thisYear = new Date().getUTCFullYear();
  const withYear = style === 'long' || Math.abs(d.getUTCFullYear() - thisYear) >= 1 && Math.abs(Date.now() - d.getTime()) > 300 * 86_400_000;
  return d.toLocaleDateString(LOCALE, withYear
    ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function ago(time: number | null | undefined, now = Date.now()): string {
  if (!time) return 'never';
  const s = Math.max(0, Math.round((now - time) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
