// Merch on Demand product types, their typical list prices, and how to spot
// each one in an Amazon title.

import type { MarketplaceId } from './marketplaces';

export type ProductType =
  | 'STANDARD_TSHIRT' | 'PREMIUM_TSHIRT' | 'VNECK' | 'TANK' | 'LONG_SLEEVE' | 'RAGLAN'
  | 'SWEATSHIRT' | 'HOODIE' | 'ZIP_HOODIE' | 'POPSOCKET' | 'PHONE_CASE' | 'TOTE' | 'PILLOW';

export interface ProductTypeInfo {
  label: string;
  short: string;
  /** Typical US list price. */
  price: number;
  /**
   * Estimated US production cost, chosen so the default royalty model matches
   * published examples ($2.44 Creator royalty on a $19.99 Standard T-shirt).
   * Users can calibrate these against Merch's live royalty display.
   */
  cost: number;
}

export const PRODUCT_TYPES: Record<ProductType, ProductTypeInfo> = {
  STANDARD_TSHIRT: { label: 'Standard T-Shirt', short: 'Tee', price: 19.99, cost: 12.11 },
  PREMIUM_TSHIRT: { label: 'Premium T-Shirt', short: 'Premium', price: 21.99, cost: 13.49 },
  VNECK: { label: 'V-Neck T-Shirt', short: 'V-Neck', price: 19.99, cost: 12.4 },
  TANK: { label: 'Tank Top', short: 'Tank', price: 19.99, cost: 12.4 },
  LONG_SLEEVE: { label: 'Long Sleeve T-Shirt', short: 'Long Sleeve', price: 24.99, cost: 15.64 },
  RAGLAN: { label: 'Raglan', short: 'Raglan', price: 23.99, cost: 14.99 },
  SWEATSHIRT: { label: 'Sweatshirt', short: 'Sweatshirt', price: 31.99, cost: 18.99 },
  HOODIE: { label: 'Pullover Hoodie', short: 'Hoodie', price: 34.99, cost: 21.34 },
  ZIP_HOODIE: { label: 'Zip Hoodie', short: 'Zip Hoodie', price: 36.99, cost: 22.41 },
  POPSOCKET: { label: 'PopSockets Grip', short: 'PopSockets', price: 14.99, cost: 9.04 },
  PHONE_CASE: { label: 'Phone Case', short: 'Case', price: 19.99, cost: 11.99 },
  TOTE: { label: 'Tote Bag', short: 'Tote', price: 19.99, cost: 12.59 },
  PILLOW: { label: 'Throw Pillow', short: 'Pillow', price: 24.99, cost: 15.84 },
};

export const PRODUCT_TYPE_IDS = Object.keys(PRODUCT_TYPES) as ProductType[];

/** Converts US prices and costs into each marketplace's currency, roughly. */
export const LOCAL_SCALE: Record<MarketplaceId, number> = {
  US: 1, UK: 0.85, DE: 1, FR: 1, IT: 1, ES: 1, JP: 150,
};

export function defaultPrice(type: ProductType, mp: MarketplaceId): number {
  const scaled = PRODUCT_TYPES[type].price * LOCAL_SCALE[mp];
  if (mp === 'JP') return Math.round(scaled / 100) * 100 - 20;
  return Math.max(0.99, Math.round(scaled) - 0.01);
}

// Order matters: the first match wins, so specific types come before generic ones.
const DETECTORS: Array<[ProductType, RegExp]> = [
  ['ZIP_HOODIE', /zip(?:per)?[\s-]?hood|zip hoodie|kapuzenjacke|veste à capuche zippée|felpa con zip|sudadera con cremallera|ジップパーカー/i],
  ['HOODIE', /hoodie|hoody|kapuzenpullover|sweat à capuche|felpa con cappuccio|sudadera con capucha|パーカー/i],
  ['SWEATSHIRT', /sweatshirt|sweat-shirt|sweatshirts|sudadera|felpa|トレーナー|スウェット/i],
  ['RAGLAN', /raglan/i],
  ['LONG_SLEEVE', /long[\s-]?sleeve|langarm|manches longues|maniche lunghe|manga larga|長袖/i],
  ['VNECK', /v[\s-]?neck|v-ausschnitt|col en v|scollo a v|cuello (?:de|en) pico|cuello en v|vネック/i],
  ['TANK', /tank[\s-]?top|tanktop|débardeur|canotta|camiseta sin mangas|タンクトップ/i],
  ['POPSOCKET', /popsockets?|popgrip/i],
  ['PHONE_CASE', /phone case|iphone case|samsung (?:galaxy )?case|handyhülle|coque|custodia|funda|スマホケース/i],
  ['TOTE', /tote bag|tote|tragetasche|stofftasche|sac fourre-tout|borsa|bolsa de tela|トートバッグ/i],
  ['PILLOW', /throw pillow|pillow|kissen|coussin|cuscino|cojín|クッション/i],
  ['PREMIUM_TSHIRT', /premium[\s-]?t[\s-]?shirt|premium tee|premium-t-shirt/i],
  ['STANDARD_TSHIRT', /t[\s-]?shirt|\btee\b|camiseta|maglietta|tシャツ/i],
];

export function detectProductType(...texts: Array<string | null | undefined>): ProductType | null {
  const haystack = texts.filter(Boolean).join(' \n ');
  if (!haystack) return null;
  for (const [type, re] of DETECTORS) if (re.test(haystack)) return type;
  return null;
}

/** Turns free text from Merch reports ("Standard t-shirt", "HOODIE_PULLOVER") into a product type. */
export function productTypeFromLabel(label: string | null | undefined): ProductType | null {
  if (!label) return null;
  const normalized = label.replace(/_/g, ' ');
  if (/^standard/i.test(normalized)) return 'STANDARD_TSHIRT';
  if (/^premium/i.test(normalized) && /shirt|tee/i.test(normalized)) return 'PREMIUM_TSHIRT';
  if (/zip/i.test(normalized)) return 'ZIP_HOODIE';
  if (/pullover|hood/i.test(normalized)) return 'HOODIE';
  return detectProductType(normalized);
}
