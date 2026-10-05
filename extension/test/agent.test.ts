import { analyzePortfolio, designTitleKey, type AgentInput } from '../src/shared/agent';
import { addDays } from '../src/shared/dates';
import { SEASONS, upcomingSeasons } from '../src/shared/seasons';
import type { CatalogItem, SaleRow } from '../src/shared/types';

const TODAY = '2026-10-05';
let n = 0;
const asin = () => `B0TEST${String(n++).padStart(4, '0')}`;

function item(title: string, type: CatalogItem['productType'], created: string, status: CatalogItem['status'] = 'live', mp: CatalogItem['marketplace'] = 'US'): CatalogItem {
  const a = asin();
  return { key: `${mp}:${a}`, asin: a, id: null, designId: null, title, brand: 'Brand', productType: type, marketplace: mp, status, rawStatus: status, price: 19.99, createdAt: created, image: null, seenAt: 0 };
}

function sales(i: CatalogItem, daysAgo: number[], extra: Partial<SaleRow> = {}): SaleRow[] {
  return daysAgo.map((d) => ({
    date: addDays(TODAY, -d), marketplace: i.marketplace!, asin: i.asin!, productType: i.productType, title: i.title,
    units: 1, cancelled: 0, returned: 0, royalty: 2.44, currency: 'USD', source: 'capture', ...extra,
  }));
}

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, k) => from + k * step);

function build(): AgentInput {
  const catalog: CatalogItem[] = [];
  const rows: SaleRow[] = [];
  // Winners: pickleball, sold all quarter, tees only.
  for (const t of ['Retro Pickleball Legend T-Shirt', 'Pickleball Dad Funny T-Shirt', 'Dink Responsibly Pickleball T-Shirt']) {
    const i = item(t, 'STANDARD_TSHIRT', '2025-06-01');
    catalog.push(i);
    rows.push(...sales(i, range(0, 89, 3)));
  }
  // Same design on a hoodie: must group with the tee.
  const hoodie = item('Retro Pickleball Legend Pullover Hoodie', 'HOODIE', '2025-06-01');
  catalog.push(hoodie);
  rows.push(...sales(hoodie, [2, 9]));
  // Rising: nurse designs, almost all sales in the last 30 days.
  for (const t of ['Night Shift Nurse Coffee T-Shirt', 'ER Nurse Life T-Shirt']) {
    const i = item(t, 'STANDARD_TSHIRT', '2026-08-15');
    catalog.push(i);
    rows.push(...sales(i, [...range(0, 28, 4), 50]));
  }
  // Fading: sold well 31–90 days ago, nothing since.
  const cat = item('Cat Nap Club T-Shirt', 'STANDARD_TSHIRT', '2025-03-01');
  catalog.push(cat);
  rows.push(...sales(cat, range(31, 89, 4)));
  // Dead weight: fishing designs, old, no sales.
  for (let k = 0; k < 8; k++) catalog.push(item(`Fishing Lure Pattern ${k} T-Shirt`, 'STANDARD_TSHIRT', '2024-11-01'));
  // One fishing design sold once 300 days ago: weak, not dead.
  const weak = item('Fishing Hook Sunset T-Shirt', 'STANDARD_TSHIRT', '2024-11-01');
  catalog.push(weak);
  rows.push(...sales(weak, [300]));
  // Halloween stock: sold last October.
  for (const t of ['Spooky Ghost Coffee Halloween T-Shirt', 'Witch Please Halloween T-Shirt']) {
    const i = item(t, 'STANDARD_TSHIRT', '2025-08-01');
    catalog.push(i);
    rows.push(...sales(i, range(345, 370, 2)));
  }
  // High returns
  const bad = item('Gym Rat Raccoon T-Shirt', 'STANDARD_TSHIRT', '2025-02-01');
  catalog.push(bad);
  rows.push(...sales(bad, range(100, 200, 15), { returned: 1 }));
  // Rejected listing: not live, never a replacement candidate.
  catalog.push(item('Rejected Thing T-Shirt', 'STANDARD_TSHIRT', '2024-01-01', 'rejected'));

  return { sales: rows, catalog, totals: [], today: TODAY, coverageFrom: '2025-09-01', currency: 'USD', fx: { USD: 1, EUR: 1.1, GBP: 1.3, JPY: 0.007 }, designLimit: 20 };
}

describe('portfolio agent', () => {
  const p = analyzePortfolio(build());
  const rec = (kind: string) => p.recommendations.find((r) => r.kind === kind);
  const titles = (kind: string) => rec(kind)?.designs.map((d) => d.title) ?? [];

  it('groups product types of one design', () => {
    expect(designTitleKey('Retro Pickleball Legend Pullover Hoodie')).toBe(designTitleKey('Retro Pickleball Legend T-Shirt'));
    const legend = p.designs.find((d) => d.title.startsWith('Retro Pickleball Legend'))!;
    expect(legend.types.sort()).toEqual(['HOODIE', 'STANDARD_TSHIRT']);
    expect(p.liveDesigns).toBe(18);
    expect(p.statusCounts.rejected).toBe(1);
  });

  it('flags dead designs for replacement, but not weak or rejected ones', () => {
    const dead = titles('replace');
    expect(dead).toHaveLength(8);
    expect(dead.every((t) => t.startsWith('Fishing Lure'))).toBe(true);
    expect(rec('replace')!.priority).toBe(1);
    expect(titles('weak')).toEqual(['Fishing Hook Sunset T-Shirt']);
  });

  it('scales winners onto more product types', () => {
    const r = rec('add-types')!;
    expect(r.designs.map((d) => d.title)).toContain('Pickleball Dad Funny T-Shirt');
    expect(r.detail![r.designs[0]!.key]).toMatch(/^Add /);
  });

  it('spots rising and fading designs', () => {
    expect(titles('rising').sort()).toEqual(['ER Nurse Life T-Shirt', 'Night Shift Nurse Coffee T-Shirt']);
    expect(titles('fading')).toEqual(['Cat Nap Club T-Shirt']);
  });

  it('ranks niches', () => {
    const pickle = p.niches.find((n) => n.name === 'pickleball')!;
    expect(pickle.verdict).toBe('double-down');
    expect(pickle.designs).toBe(3);
    expect(p.niches.find((n) => n.name === 'fishing')!.verdict).toBe('stop');
    expect(rec('niche-more')!.niche).toContain('pickleball');
    expect(rec('niche-stop')!.niche).toMatch(/fishing/);
  });

  it('prepares for Halloween with last year’s numbers', () => {
    const halloween = p.recommendations.find((r) => r.id.startsWith('season-halloween'))!;
    expect(halloween.title).toBe('Halloween is in 26 days: you have 2 designs for it');
    expect(halloween.impact).toMatch(/Last year these designs sold \d+ units/);
  });

  it('flags high returns', () => {
    expect(titles('returns')).toEqual(['Gym Rat Raccoon T-Shirt']);
  });

  it('never recommends deleting everything when sales are missing', () => {
    const input = build();
    const empty = analyzePortfolio({ ...input, sales: [] });
    expect(empty.recommendations.find((r) => r.kind === 'replace')).toBeUndefined();
    const noHistory = analyzePortfolio({ ...input, coverageFrom: '2026-10-01' });
    expect(noHistory.recommendations.find((r) => r.kind === 'replace')).toBeUndefined();
  });

  it('keeps seasonal designs out of the replace list without a full year of history', () => {
    const input = build();
    const recent = analyzePortfolio({ ...input, coverageFrom: addDays(TODAY, -150), sales: input.sales.filter((r) => r.date >= addDays(TODAY, -150)) });
    const replace = recent.recommendations.find((r) => r.kind === 'replace')!;
    expect(replace.designs.some((d) => /halloween/i.test(d.title))).toBe(false);
    expect(replace.why).toMatch(/ 2 seasonal designs are left out/);
  });

  it('works from sales alone when the catalog is unknown', () => {
    const input = build();
    const salesOnly = analyzePortfolio({ ...input, catalog: [] });
    expect(salesOnly.catalogKnown).toBe(false);
    expect(salesOnly.recommendations.find((r) => r.kind === 'replace')).toBeUndefined();
    expect(salesOnly.recommendations.find((r) => r.kind === 'rising')).toBeDefined();
  });
});

describe('seasons', () => {
  it('matches whole words only', () => {
    const halloween = SEASONS.find((s) => s.id === 'halloween')!;
    const nurse = SEASONS.find((s) => s.id === 'nurse')!;
    expect(nurse.keywords.test(' fishing lure pattern 1 t shirt ')).toBe(false);
    expect(nurse.keywords.test(' er nurse life t shirt ')).toBe(true);
    expect(halloween.keywords.test(' bookworm t shirt ')).toBe(false);
    expect(halloween.keywords.test(' witchy vibes ')).toBe(true);
  });

  it('lists upcoming selling windows with upload deadlines', () => {
    const list = upcomingSeasons('2026-10-05', 90);
    expect(list.map((s) => s.season.id)).toEqual(['halloween', 'thanksgiving', 'christmas', 'newyear']);
    expect(list[1]!.date).toBe('2026-11-26');
    expect(list[2]).toMatchObject({ date: '2026-12-25', sellingFrom: '2026-10-31', uploadBy: '2026-10-17' });
  });
});
