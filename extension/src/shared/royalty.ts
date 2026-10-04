// Royalty estimates. Since June 2026 Merch pays one of three traffic-based
// tiers; Plus pays twice Creator and Premium about 2.16x. The model:
//
//   base    = netPrice × (1 − referral) − productionCost      (netPrice excludes VAT)
//   royalty = base × creatorShare × tierMultiplier
//
// With the default constants this gives $2.44 / $4.88 / $5.27 for a $19.99
// Standard T-shirt. Every constant is editable in Settings, and costs can be
// calibrated from the royalty Merch shows on its create page.

import { MARKETPLACES, type MarketplaceId } from './marketplaces';
import { LOCAL_SCALE, PRODUCT_TYPES, type ProductType } from './products';

export type RoyaltyTier = 'creator' | 'plus' | 'premium';

export const TIER_LABELS: Record<RoyaltyTier, string> = {
  creator: 'Creator',
  plus: 'Plus',
  premium: 'Premium',
};

export interface RoyaltyModel {
  referralRate: number;
  creatorShare: number;
  tierMultipliers: Record<RoyaltyTier, number>;
  /** Overrides for production cost, per product type and marketplace, in local currency. */
  costOverrides: Partial<Record<ProductType, Partial<Record<MarketplaceId, number>>>>;
}

export const DEFAULT_ROYALTY_MODEL: RoyaltyModel = {
  referralRate: 0.15,
  creatorShare: 0.5,
  tierMultipliers: { creator: 1, plus: 2, premium: 2.16 },
  costOverrides: {},
};

export function productionCost(model: RoyaltyModel, type: ProductType, mp: MarketplaceId): number {
  const override = model.costOverrides[type]?.[mp];
  if (typeof override === 'number' && Number.isFinite(override)) return override;
  return round(PRODUCT_TYPES[type].cost * LOCAL_SCALE[mp]);
}

export function netPrice(price: number, mp: MarketplaceId): number {
  return price / (1 + MARKETPLACES[mp].vat);
}

export function estimateRoyalty(
  model: RoyaltyModel,
  type: ProductType,
  mp: MarketplaceId,
  price: number,
  tier: RoyaltyTier,
): number {
  const base = netPrice(price, mp) * (1 - model.referralRate) - productionCost(model, type, mp);
  const royalty = base * model.creatorShare * model.tierMultipliers[tier];
  return Math.max(0, round(royalty));
}

export function royaltyAllTiers(model: RoyaltyModel, type: ProductType, mp: MarketplaceId, price: number) {
  return {
    creator: estimateRoyalty(model, type, mp, price, 'creator'),
    plus: estimateRoyalty(model, type, mp, price, 'plus'),
    premium: estimateRoyalty(model, type, mp, price, 'premium'),
  };
}

/** Lowest list price that earns a positive royalty. */
export function breakEvenPrice(model: RoyaltyModel, type: ProductType, mp: MarketplaceId): number {
  const cost = productionCost(model, type, mp);
  return round((cost / (1 - model.referralRate)) * (1 + MARKETPLACES[mp].vat));
}

/**
 * Solves for the production cost that makes the model reproduce a royalty the
 * user read off Merch for a given price and tier.
 */
export function calibrateCost(
  model: RoyaltyModel,
  mp: MarketplaceId,
  price: number,
  tier: RoyaltyTier,
  observedRoyalty: number,
): number {
  const base = observedRoyalty / (model.creatorShare * model.tierMultipliers[tier]);
  return round(netPrice(price, mp) * (1 - model.referralRate) - base);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
