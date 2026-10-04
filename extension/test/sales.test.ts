import { aggregate, contextFromUrl, importSalesCsv, mergeSales, normalizePayload, toDay } from '../src/shared/sales';
import { dailySeries, productSummaries, totals, breakdown, bucketSeries } from '../src/shared/analytics';
import { demoSales } from '../src/shared/demo';
import type { SaleRow } from '../src/shared/types';

const FX = { USD: 1, EUR: 1.1, GBP: 1.25, JPY: 0.007 };

describe('normalizePayload', () => {
  it('reads flat per-ASIN daily records', () => {
    const rows = normalizePayload({
      records: [
        { asin: 'B0AAAAAAAA', date: '2026-10-03', marketplaceId: 'ATVPDKIKX0DER', unitsSold: 3, royalty: 7.32, currencyCode: 'USD', productType: 'STANDARD_TSHIRT', title: 'Cat Tee' },
        { asin: 'B0BBBBBBBB', date: '2026-10-03', marketplaceId: 'A1PA6795UKMFR9', unitsSold: 1, royalty: '2,10', currencyCode: 'EUR' },
      ],
    });
    expect(rows).toEqual([
      expect.objectContaining({ asin: 'B0AAAAAAAA', date: '2026-10-03', marketplace: 'US', units: 3, royalty: 7.32, currency: 'USD', productType: 'STANDARD_TSHIRT', title: 'Cat Tee' }),
      expect.objectContaining({ asin: 'B0BBBBBBBB', marketplace: 'DE', units: 1, royalty: 2.1, currency: 'EUR' }),
    ]);
  });

  it('inherits date and marketplace from parent objects and reads money objects', () => {
    const rows = normalizePayload({
      marketplace: 'amazon.co.uk',
      days: [
        {
          day: 1759536000000,
          items: [{ ASIN: 'b0cccccccc', metrics: { purchased: 2, cancelled: 1, royalties: { amount: 3.5, currencyCode: 'GBP' } } }],
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ asin: 'B0CCCCCCCC', marketplace: 'UK', units: 2, cancelled: 1, royalty: 3.5, currency: 'GBP' });
    expect(rows[0]!.date).toMatch(/^2025-10-0[34]$/);
  });

  it('takes the date from a single-day request URL when rows have none', () => {
    const rows = normalizePayload([{ asin: 'B0DDDDDDDD', units: 4, royalty: 9.76 }], '/api/sales?fromDate=2026-10-04&toDate=2026-10-04&marketplaceId=ATVPDKIKX0DER');
    expect(rows[0]).toMatchObject({ date: '2026-10-04', marketplace: 'US', units: 4 });
    expect(contextFromUrl('/x?from=2026-10-01&to=2026-10-04')).toEqual({});
  });

  it('sums rows for the same product and day (per-order or per-size payloads)', () => {
    const rows = normalizePayload([
      { asin: 'B0EEEEEEEE', date: '2026-10-04', marketplace: 'US', units: 1, royalty: 2.44 },
      { asin: 'B0EEEEEEEE', date: '2026-10-04', marketplace: 'US', units: 2, royalty: 4.88 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ units: 3, royalty: 7.32 });
  });

  it('ignores objects that are not sales', () => {
    expect(normalizePayload({ products: [{ asin: 'B0FFFFFFFF', status: 'LIVE', title: 'x' }] })).toEqual([]);
    expect(normalizePayload({ asin: 'not-an-asin', units: 3, date: '2026-10-04', marketplace: 'US' })).toEqual([]);
    expect(normalizePayload({ totals: { units: 5, royalty: 10, date: '2026-10-04' } })).toEqual([]);
    expect(normalizePayload(null)).toEqual([]);
  });

  it('parses date formats', () => {
    expect(toDay('2026-10-04T07:00:00.000Z')).toBe('2026-10-04');
    expect(toDay('10/04/2026')).toBe('2026-10-04');
    expect(toDay(1759536000)).toMatch(/^2025-10-0[34]$/);
    expect(toDay('garbage')).toBeNull();
  });
});

describe('mergeSales', () => {
  const row = (units: number, date = '2026-10-04'): SaleRow => ({
    date, marketplace: 'US', asin: 'B0AAAAAAAA', productType: 'STANDARD_TSHIRT', title: 'Cat Tee',
    units, cancelled: 0, returned: 0, royalty: units * 2.44, currency: 'USD', source: 'capture',
  });

  it('does not announce history on the first import', () => {
    const result = mergeSales({}, [row(3)], '2026-10-04');
    expect(result.added).toBe(1);
    expect(result.newSales).toEqual([]);
  });

  it('reports the increase on a recaptured day', () => {
    const first = mergeSales({}, [row(3)], '2026-10-04');
    const second = mergeSales(first.store, [row(5)], '2026-10-04');
    expect(second.updated).toBe(1);
    expect(second.newSales).toHaveLength(1);
    expect(second.newSales[0]).toMatchObject({ units: 2, royalty: 4.88 });
    expect(Object.values(second.store)[0]!.units).toBe(5);
  });

  it('ignores unchanged rows and old days', () => {
    const first = mergeSales({ seed: row(1, '2026-01-01') }, [row(3)], '2026-10-04');
    expect(first.newSales).toHaveLength(1);
    const same = mergeSales(first.store, [row(3)], '2026-10-04');
    expect(same.added + same.updated).toBe(0);
    const old = mergeSales(first.store, [row(9, '2026-09-01')], '2026-10-04');
    expect(old.newSales).toEqual([]);
  });
});

describe('importSalesCsv', () => {
  it('maps headers and reads rows, with semicolons and decimal commas', () => {
    const csv = '﻿Date;ASIN;Title;Marketplace;Product Type;Units Cancelled;Units Sold;Royalty;Currency\n' +
      '2026-10-01;B0AAAAAAAA;"Cat; Tee";Amazon.de;Standard T-shirt;0;2;"4,20";EUR\n' +
      '2026-10-01;B0AAAAAAAA;"Cat; Tee";Amazon.de;Standard T-shirt;1;1;"2,10";EUR\n' +
      'bad;row\n';
    const result = importSalesCsv(csv, 'US');
    expect(result.mapping).toMatchObject({ date: 0, asin: 1, title: 2, marketplace: 3, productType: 4, cancelled: 5, units: 6, royalty: 7, currency: 8 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ marketplace: 'DE', units: 3, cancelled: 1, royalty: 6.3, currency: 'EUR', title: 'Cat; Tee', source: 'csv' });
    expect(result.skipped).toBe(1);
  });
});

describe('analytics', () => {
  const rows = demoSales('2026-10-04', 120);

  it('generates deterministic demo data', () => {
    expect(rows.length).toBeGreaterThan(500);
    expect(demoSales('2026-10-04', 120)).toEqual(rows);
    expect(aggregate(rows)).toHaveLength(rows.length);
  });

  it('computes totals, daily series and breakdowns that agree', () => {
    const range = { from: '2026-09-05', to: '2026-10-04' };
    const inRange = rows.filter((r) => r.date >= range.from && r.date <= range.to);
    const t = totals(inRange, 'USD', FX);
    const series = dailySeries(inRange, range, 'USD', FX);
    expect(series).toHaveLength(30);
    expect(series.reduce((s, p) => s + p.units, 0)).toBe(t.units);
    expect(series.reduce((s, p) => s + p.royalty, 0)).toBeCloseTo(t.royalty, 6);
    const byMarket = breakdown(inRange, (r) => r.marketplace, 'USD', FX);
    expect(byMarket.reduce((s, b) => s + b.units, 0)).toBe(t.units);
    expect(byMarket.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 6);
    const weekly = bucketSeries(series, 'week');
    expect(weekly.reduce((s, p) => s + p.units, 0)).toBe(t.units);
  });

  it('summarizes products with days since last sale', () => {
    const summaries = productSummaries(rows, { from: '2026-01-01', to: '2026-10-04' }, '2026-10-04', 'USD', FX);
    expect(summaries.length).toBeGreaterThan(10);
    for (const s of summaries) {
      if (s.lastSale) expect(s.daysSinceSale).toBeGreaterThanOrEqual(0);
    }
    expect(summaries[0]!.units).toBeGreaterThanOrEqual(summaries[1]!.units);
  });
});
