// The seven Amazon marketplaces Merch on Demand sells into.

export type MarketplaceId = 'US' | 'UK' | 'DE' | 'FR' | 'IT' | 'ES' | 'JP';
export type Currency = 'USD' | 'GBP' | 'EUR' | 'JPY';

export interface Marketplace {
  id: MarketplaceId;
  name: string;
  flag: string;
  domain: string;
  currency: Currency;
  /** Amazon's marketplace ID, used by the search-suggestion API. */
  mid: string;
  /** BCP-47 locale used to format numbers and dates for this store. */
  locale: string;
  /** VAT included in list prices (Amazon prices are VAT-inclusive in UK/EU/JP). */
  vat: number;
  /**
   * Rough share of US sales volume at the same BSR. A #50,000 rank on amazon.de
   * moves far fewer units than #50,000 on amazon.com.
   */
  salesScale: number;
  /** Text Amazon prints in every standard Merch t-shirt listing on this store. */
  merchBullet: string;
}

export const MARKETPLACES: Record<MarketplaceId, Marketplace> = {
  US: {
    id: 'US', name: 'United States', flag: '🇺🇸', domain: 'amazon.com', currency: 'USD',
    mid: 'ATVPDKIKX0DER', locale: 'en-US', vat: 0, salesScale: 1,
    merchBullet: 'Lightweight, Classic fit, Double-needle sleeve and bottom hem',
  },
  UK: {
    id: 'UK', name: 'United Kingdom', flag: '🇬🇧', domain: 'amazon.co.uk', currency: 'GBP',
    mid: 'A1F83G8C2ARO7P', locale: 'en-GB', vat: 0.2, salesScale: 0.3,
    merchBullet: 'Lightweight, Classic fit, Double-needle sleeve and bottom hem',
  },
  DE: {
    id: 'DE', name: 'Germany', flag: '🇩🇪', domain: 'amazon.de', currency: 'EUR',
    mid: 'A1PA6795UKMFR9', locale: 'de-DE', vat: 0.19, salesScale: 0.35,
    merchBullet: 'Leicht, klassisch geschnitten, doppelt genähter Saum',
  },
  FR: {
    id: 'FR', name: 'France', flag: '🇫🇷', domain: 'amazon.fr', currency: 'EUR',
    mid: 'A13V1IB3VIYZZH', locale: 'fr-FR', vat: 0.2, salesScale: 0.15,
    merchBullet: 'Léger, Coupe classique, Manches double couture et ourlet bas',
  },
  IT: {
    id: 'IT', name: 'Italy', flag: '🇮🇹', domain: 'amazon.it', currency: 'EUR',
    mid: 'APJ6JRA9NG5V4', locale: 'it-IT', vat: 0.22, salesScale: 0.12,
    merchBullet: 'Leggera, taglio classico, maniche con doppia cucitura e orlo inferiore',
  },
  ES: {
    id: 'ES', name: 'Spain', flag: '🇪🇸', domain: 'amazon.es', currency: 'EUR',
    mid: 'A1RKKUPIHCS9HS', locale: 'es-ES', vat: 0.21, salesScale: 0.12,
    merchBullet: 'Ligera, Encaje clásico, Manga de doble puntada y bastilla baja',
  },
  JP: {
    id: 'JP', name: 'Japan', flag: '🇯🇵', domain: 'amazon.co.jp', currency: 'JPY',
    mid: 'A1VC38T7YXB528', locale: 'ja-JP', vat: 0.1, salesScale: 0.2,
    merchBullet: '軽量、クラシックフィット、袖と裾はダブルステッチ仕上げ',
  },
};

export const MARKETPLACE_IDS = Object.keys(MARKETPLACES) as MarketplaceId[];

/** Maps a hostname such as `www.amazon.co.uk` to its marketplace. */
export function marketplaceFromHost(host: string): MarketplaceId | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const id of MARKETPLACE_IDS) {
    if (h === MARKETPLACES[id].domain) return id;
  }
  return null;
}

/** Maps Amazon marketplace IDs, currency codes or country codes to a marketplace. */
export function marketplaceFromAny(value: unknown): MarketplaceId | null {
  if (typeof value !== 'string' || !value) return null;
  const v = value.trim();
  const upper = v.toUpperCase();
  for (const id of MARKETPLACE_IDS) {
    const m = MARKETPLACES[id];
    if (upper === id || upper === m.mid) return id;
  }
  if (upper === 'GB' || upper === 'GBR') return 'UK';
  if (upper === 'USA') return 'US';
  for (const id of MARKETPLACE_IDS) {
    if (v.toLowerCase() === MARKETPLACES[id].name.toLowerCase()) return id;
  }
  const locale = v.match(/^[a-z]{2}[-_]([a-z]{2})$/i);
  if (locale) return marketplaceFromAny(locale[1]!.toUpperCase());
  const host = marketplaceFromHost(v.replace(/^https?:\/\//, '').split('/')[0] ?? '');
  if (host) return host;
  const lower = v.toLowerCase();
  if (lower.includes('amazon.co.uk')) return 'UK';
  if (lower.includes('amazon.co.jp')) return 'JP';
  for (const id of ['DE', 'FR', 'IT', 'ES'] as const) {
    if (lower.includes(MARKETPLACES[id].domain)) return id;
  }
  if (lower.includes('amazon.com')) return 'US';
  return null;
}

export function origin(id: MarketplaceId): string {
  return `https://www.${MARKETPLACES[id].domain}`;
}

export function productUrl(id: MarketplaceId, asin: string): string {
  return `${origin(id)}/dp/${asin}`;
}

/**
 * Search URL scoped to Merch on Demand shirts. The `hidden-keywords` filter
 * matches the stock bullet Amazon adds to every Merch listing, which removes
 * nearly all non-Merch products from the results. `template` lets users
 * override this per marketplace in Settings; `{keyword}` is substituted.
 */
export function merchSearchUrl(id: MarketplaceId, keyword: string, template?: string): string {
  if (template && template.includes('{keyword}')) {
    return template.replace('{keyword}', encodeURIComponent(keyword.trim()));
  }
  const params = new URLSearchParams({ k: keyword.trim() });
  if (id === 'US') {
    params.set('i', 'fashion-novelty');
    params.set('rh', 'p_6:ATVPDKIKX0DER');
  }
  params.set('hidden-keywords', MARKETPLACES[id].merchBullet);
  return `${origin(id)}/s?${params.toString()}`;
}

export function plainSearchUrl(id: MarketplaceId, keyword: string): string {
  return `${origin(id)}/s?${new URLSearchParams({ k: keyword.trim() }).toString()}`;
}
