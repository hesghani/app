import type { FxRates } from './analytics';
import { DEFAULT_HEAT, type HeatThresholds } from './bsr';
import type { SuggestionAlias } from './keywords';
import type { Currency, MarketplaceId } from './marketplaces';
import { DEFAULT_ROYALTY_MODEL, type RoyaltyModel, type RoyaltyTier } from './royalty';

export interface Settings {
  marketplace: MarketplaceId;
  displayCurrency: Currency;
  fx: FxRates;
  royaltyTier: RoyaltyTier;
  royalty: RoyaltyModel;

  // Amazon research overlay
  overlayEnabled: boolean;
  autoAnalyze: boolean;
  productPanel: boolean;
  concurrency: number;
  cacheHours: number;
  heat: HeatThresholds;
  suggestionAlias: SuggestionAlias;
  searchTemplates: Partial<Record<MarketplaceId, string>>;

  // Merch on Demand
  notifications: boolean;
  badge: boolean;
  liveRefresh: boolean;
  liveRefreshMinutes: number;
  /** Merch removes listings without a sale for this long. */
  inactivityMonths: number;

  // Watchlist
  watchRefreshHours: number;

  // Trademarks
  customTerms: string[];
  ignoredTerms: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  marketplace: 'US',
  displayCurrency: 'USD',
  fx: { USD: 1, EUR: 1.16, GBP: 1.34, JPY: 0.0067 },
  royaltyTier: 'creator',
  royalty: DEFAULT_ROYALTY_MODEL,

  overlayEnabled: true,
  autoAnalyze: true,
  productPanel: true,
  concurrency: 2,
  cacheHours: 12,
  heat: DEFAULT_HEAT,
  suggestionAlias: 'aps',
  searchTemplates: {},

  notifications: true,
  badge: true,
  liveRefresh: false,
  liveRefreshMinutes: 15,
  inactivityMonths: 18,

  watchRefreshHours: 24,

  customTerms: [],
  ignoredTerms: [],
};

/** Fills in fields added in newer versions so old saved settings keep working. */
export function withDefaults(saved: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
  s.fx = { ...DEFAULT_SETTINGS.fx, ...(saved?.fx ?? {}) };
  s.heat = { ...DEFAULT_SETTINGS.heat, ...(saved?.heat ?? {}) };
  s.royalty = {
    ...DEFAULT_ROYALTY_MODEL,
    ...(saved?.royalty ?? {}),
    tierMultipliers: { ...DEFAULT_ROYALTY_MODEL.tierMultipliers, ...(saved?.royalty?.tierMultipliers ?? {}) },
    costOverrides: { ...(saved?.royalty?.costOverrides ?? {}) },
  };
  return s;
}
