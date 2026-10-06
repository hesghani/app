import { analyzePortfolio } from '../src/shared/agent';
import { EVENTS, eventDates } from '../src/shared/events';
import type { CatalogItem, SaleRow } from '../src/shared/types';

const dateOf = (id: string, y: number) => EVENTS.find((e) => e.id === id)!.date(y);

describe('event calendar', () => {
  it('computes moving school and work days', () => {
    expect(dateOf('unity-day', 2025)).toBe('2025-10-22');
    expect(dateOf('unity-day', 2026)).toBe('2026-10-21');
    expect(dateOf('admin-day', 2026)).toBe('2026-04-22');
    expect(dateOf('admin-day', 2027)).toBe('2027-04-21');
    expect(dateOf('teacher-week', 2027)).toBe('2027-05-03');
    expect(dateOf('pink-shirt-day', 2027)).toBe('2027-02-24');
    expect(dateOf('mardi-gras', 2027)).toBe('2027-02-09');
    expect(dateOf('oktoberfest', 2026)).toBe('2026-09-19');
    expect(dateOf('grandparents', 2026)).toBe('2026-09-13');
    expect(dateOf('dot-day', 2026)).toBe('2026-09-15');
    expect(dateOf('school-nurse', 2026)).toBe('2026-05-06');
  });

  it('lists what is ahead with upload deadlines, and drops faded trends', () => {
    const list = eventDates('2026-10-06', 60);
    const unity = list.find((e) => e.event.id === 'unity-day')!;
    expect(unity.start).toBe('2026-10-21');
    expect(unity.sellFrom).toBe('2026-09-23');
    expect(list.some((e) => e.event.id === 'red-ribbon')).toBe(true);
    expect(list.some((e) => e.event.id === 'dot-day')).toBe(false);
    expect(eventDates('2027-08-01', 60).some((e) => e.event.id === 'six-seven')).toBe(false);
  });
});

describe('planner', () => {
  const today = '2026-10-06';
  const item = (i: number, title: string): CatalogItem => ({
    key: `L:${i}`, asin: `B0TEST${String(i).padStart(4, '0')}`, id: null, designId: `d${i}`, title, brand: 'B', productType: 'STANDARD_TSHIRT', marketplace: 'US',
    status: 'live', rawStatus: 'LIVE', price: 19.99, createdAt: '2024-01-01', image: null, seenAt: 0,
  });
  const catalog = [item(1, 'Unity Day Orange Choose Kind Teacher T-Shirt'), item(2, 'Red Ribbon Week Drug Free T-Shirt'), ...Array.from({ length: 8 }, (_, i) => item(10 + i, `Nurse Life Coffee ${i} T-Shirt`))];
  // Nurse designs sell every month; Unity Day sold last October.
  const sales: SaleRow[] = [];
  for (let m = 0; m < 12; m++) {
    const month = new Date(Date.UTC(2025, 10 + m, 1)).toISOString().slice(0, 7);
    for (let i = 0; i < 8; i++) sales.push({ date: `${month}-01`, until: `${month}-28`, marketplace: 'US', asin: `B0TEST${String(10 + i).padStart(4, '0')}`, productType: 'STANDARD_TSHIRT', title: '', units: 3, cancelled: 0, returned: 0, royalty: 7, currency: 'USD', source: 'capture' });
  }
  sales.push({ date: '2025-10-10', marketplace: 'US', asin: 'B0TEST0001', productType: 'STANDARD_TSHIRT', title: '', units: 25, cancelled: 0, returned: 0, royalty: 60, currency: 'USD', source: 'capture' });
  const fx = { USD: 1, EUR: 1.08, GBP: 1.27, JPY: 0.0067 };
  const p = analyzePortfolio({ sales, catalog, totals: [], today, coverageFrom: '2025-09-01', currency: 'USD', fx, designLimit: 1000 });

  it('ranks small events in their upload window first and knows last year', () => {
    const unity = p.plan.find((x) => x.id === 'unity-day')!;
    expect(unity.stage).toBe('selling');
    expect(unity.designs).toBe(1);
    expect(unity.lastYear).toBe(25);
    const firstBig = p.plan.findIndex((x) => x.size === 3);
    const firstSmall = p.plan.findIndex((x) => x.size === 1);
    expect(firstSmall).toBeLessThan(firstBig);
  });

  it('finds niches that sell all year', () => {
    // "nurse" and "coffee" always appear together: one niche, under one of the names.
    const steady = p.evergreens.find((e) => e.name === 'nurse' || e.name === 'coffee')!;
    expect(steady.months).toBeGreaterThanOrEqual(9);
    expect(steady.designs).toBe(8);
  });
});
