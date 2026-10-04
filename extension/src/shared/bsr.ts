// Best Sellers Rank → estimated daily sales. Amazon doesn't publish this, so
// the curve below is interpolated in log-log space between anchor points that
// reflect widely shared seller observations for Clothing on amazon.com. Other
// marketplaces are scaled down by their relative size. Treat as a ballpark.

import { MARKETPLACES, type MarketplaceId } from './marketplaces';

const ANCHORS: Array<[number, number]> = [
  [1, 1200],
  [100, 300],
  [1_000, 80],
  [5_000, 22],
  [10_000, 11],
  [50_000, 2.6],
  [100_000, 1.2],
  [250_000, 0.45],
  [500_000, 0.2],
  [1_000_000, 0.07],
  [2_000_000, 0.025],
  [5_000_000, 0.005],
  [10_000_000, 0.001],
];

export function salesPerDay(bsr: number | null | undefined, mp: MarketplaceId = 'US'): number | null {
  if (!bsr || bsr < 1) return null;
  const x = Math.log10(bsr);
  let value: number;
  const first = ANCHORS[0]!;
  const last = ANCHORS[ANCHORS.length - 1]!;
  if (bsr <= first[0]) value = first[1];
  else if (bsr >= last[0]) value = last[1];
  else {
    let i = 0;
    while (ANCHORS[i + 1]![0] < bsr) i++;
    const [r0, s0] = ANCHORS[i]!;
    const [r1, s1] = ANCHORS[i + 1]!;
    const t = (x - Math.log10(r0)) / (Math.log10(r1) - Math.log10(r0));
    value = 10 ** (Math.log10(s0) + t * (Math.log10(s1) - Math.log10(s0)));
  }
  return value * MARKETPLACES[mp].salesScale;
}

export function salesPerMonth(bsr: number | null | undefined, mp: MarketplaceId = 'US'): number | null {
  const daily = salesPerDay(bsr, mp);
  return daily === null ? null : daily * 30;
}

export type Heat = 'hot' | 'good' | 'ok' | 'slow' | 'cold' | 'none';

export interface HeatThresholds { hot: number; good: number; ok: number; slow: number }

export const DEFAULT_HEAT: HeatThresholds = { hot: 10_000, good: 100_000, ok: 500_000, slow: 1_500_000 };

export function heat(bsr: number | null | undefined, t: HeatThresholds = DEFAULT_HEAT): Heat {
  if (!bsr) return 'none';
  if (bsr <= t.hot) return 'hot';
  if (bsr <= t.good) return 'good';
  if (bsr <= t.ok) return 'ok';
  if (bsr <= t.slow) return 'slow';
  return 'cold';
}

export const HEAT_LABELS: Record<Heat, string> = {
  hot: 'Hot seller',
  good: 'Selling well',
  ok: 'Selling',
  slow: 'Occasional sales',
  cold: 'Rarely sells',
  none: 'No rank yet',
};

/** "≈ 36/mo", "≈ 2/mo", "<1/mo". */
export function formatMonthly(perMonth: number | null): string {
  if (perMonth === null) return '–';
  if (perMonth < 1) return '<1/mo';
  if (perMonth < 10) return `≈${perMonth.toFixed(perMonth < 3 ? 1 : 0)}/mo`;
  return `≈${Math.round(perMonth).toLocaleString('en-US')}/mo`;
}
