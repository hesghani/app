import { buildRequest, chunks, describeRequest, describeShape, isCatalogSource, isSafeToReplay, isStrongCatalog, isStrongSales, learn, nextPage, rankTemplates, type Capture } from '../src/shared/learn';
import { normalizeCatalog, normalizeStatus } from '../src/shared/catalog';
import { normalizeSales } from '../src/shared/sales';
import { shiftZonedDays, zonedDay, zonedToEpoch } from '../src/shared/zoned';

const at = Date.parse('2026-10-05T18:00:00Z');
const cap = (c: Partial<Capture>): Capture => ({ url: '', method: 'GET', status: 200, headers: {}, payload: null, at, ...c });

describe('Pacific calendar helpers', () => {
  it('keeps midnight Pacific across daylight saving', () => {
    const oct = zonedToEpoch(2026, 10, 1);
    expect(zonedDay(oct)).toBe('2026-10-01');
    const dec = shiftZonedDays(oct, 61);
    expect(zonedDay(dec)).toBe('2026-12-01');
    expect(new Date(dec).getUTCHours()).toBe(8); // PST midnight = 08:00 UTC
    expect(new Date(oct).getUTCHours()).toBe(7); // PDT midnight = 07:00 UTC
  });
});

describe('style A: GET with epoch range, dated per-record rows', () => {
  const from = zonedToEpoch(2026, 9, 29);
  const to = zonedToEpoch(2026, 10, 5, 23, 59, 59, 999);
  const capture = cap({
    url: `https://merch.amazon.com/api/reporting/purchases/records?marketplaceId=ATVPDKIKX0DER&fromDate=${from}&toDate=${to}`,
    headers: { 'x-csrf-token': 'abc' },
    payload: [
      { date: zonedToEpoch(2026, 10, 4), asin: 'B0AAAAAAAA', productType: 'STANDARD_TSHIRT', unitsSold: 2, unitsCancelled: 0, royalty: { value: 4.88, currencyCode: 'USD' }, title: 'Cat' },
      { date: zonedToEpoch(2026, 10, 5), asin: 'B0AAAAAAAA', productType: 'STANDARD_TSHIRT', unitsSold: 1, unitsCancelled: 1, royalty: { value: 2.44, currencyCode: 'USD' }, title: 'Cat' },
    ],
  });
  const learned = learn(capture);
  const t = learned.template!;

  it('learns a dated sales template with a range and a marketplace', () => {
    expect(learned.kind).toBe('sales');
    expect(learned.dated).toBe(true);
    expect(learned.rows.map((r) => r.date)).toEqual(['2026-10-04', '2026-10-05']);
    expect(t.dates.map((d) => [d.role, d.format])).toEqual([['from', 'epoch-ms'], ['to', 'epoch-ms']]);
    expect(t.window).toEqual({ from: '2026-09-29', to: '2026-10-05' });
    expect(t.markets).toHaveLength(1);
    expect(t.dated).toBe(true);
  });

  it('builds the same request for another range and marketplace, keeping conventions', () => {
    const r = buildRequest(t, { from: '2026-01-01', to: '2026-01-31', marketplace: 'DE' });
    const u = new URL(r.url);
    expect(u.searchParams.get('marketplaceId')).toBe('A1PA6795UKMFR9');
    expect(zonedDay(Number(u.searchParams.get('fromDate')))).toBe('2026-01-01');
    expect(new Date(Number(u.searchParams.get('fromDate'))).getUTCHours()).toBe(8);
    const end = Number(u.searchParams.get('toDate'));
    expect(zonedDay(end)).toBe('2026-01-31');
    expect(end % 1000).toBe(999);
    expect(r.headers['x-csrf-token']).toBe('abc');
    expect(r.body).toBeUndefined();
  });
});

describe('style B: POST JSON body with ISO dates, columnar per-ASIN totals', () => {
  const capture = cap({
    url: 'https://merch.amazon.com/api/ng-amazon/coral/SalesService.getSalesReport',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-10-05', endDate: '2026-10-05', marketplaces: ['US'], groupBy: 'ASIN' }),
    payload: {
      report: {
        columns: ['asin', 'title', 'purchased', 'cancelled', 'returned', 'royalties', 'marketplace'],
        rows: [
          ['B0BBBBBBBB', 'Dog Dad', 3, 0, 1, 7.32, 'US'],
          ['B0CCCCCCCC', 'Plant Mom', 1, 0, 0, 2.44, 'US'],
        ],
      },
    },
  });
  const learned = learn(capture);
  const t = learned.template!;

  it('reads columnar rows, dates them from the single-day request, and marks them undated', () => {
    expect(learned.rows).toHaveLength(2);
    expect(learned.rows[0]).toMatchObject({ asin: 'B0BBBBBBBB', date: '2026-10-05', units: 3, returned: 1, royalty: 7.32 });
    expect(learned.dated).toBe(false);
    expect(t.bodyType).toBe('json');
    expect(t.window).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(t.markets[0]).toMatchObject({ format: 'code' });
  });

  it('rewrites the body for a new day and marketplace', () => {
    const r = buildRequest(t, { from: '2026-09-30', to: '2026-09-30', marketplace: 'UK' });
    expect(JSON.parse(r.body!)).toEqual({ startDate: '2026-09-30', endDate: '2026-09-30', marketplaces: ['UK'], groupBy: 'ASIN' });
    expect(r.method).toBe('POST');
  });
});

describe('style C: catalog via POST with next-page tokens and nested listings', () => {
  const capture = cap({
    url: 'https://merch.amazon.com/api/products/search',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pageSize: 2, filters: { status: ['LIVE'] } }),
    payload: {
      products: [
        {
          id: 'p1', designId: 'd1', title: 'Retro Pickleball Legend', brand: 'Dinkworthy', productType: 'STANDARD_TSHIRT', createdDate: '2025-01-02T10:00:00Z',
          listings: [
            { marketplaceId: 'ATVPDKIKX0DER', asin: 'B0DDDDDDD1', status: 'LIVE', price: { amount: 19.99, currencyCode: 'USD' } },
            { marketplaceId: 'A1PA6795UKMFR9', asin: 'B0DDDDDDD2', status: 'LIVE', price: { amount: 17.99, currencyCode: 'EUR' } },
          ],
        },
        { id: 'p2', designId: 'd2', title: 'Never Sold Tee', brand: 'X', productType: 'PREMIUM_TSHIRT', status: 'REJECTED' },
      ],
      nextToken: 'tok-2',
    },
  });
  const learned = learn(capture);
  const t = learned.template!;

  it('expands listings and inherits product fields', () => {
    expect(learned.kind).toBe('catalog');
    expect(learned.items).toHaveLength(3);
    const de = learned.items.find((i) => i.asin === 'B0DDDDDDD2')!;
    expect(de).toMatchObject({ marketplace: 'DE', title: 'Retro Pickleball Legend', designId: 'd1', status: 'live', price: 17.99, createdAt: '2025-01-02', productType: 'STANDARD_TSHIRT' });
    expect(learned.items.find((i) => i.id === 'p2')).toMatchObject({ asin: null, status: 'rejected', productType: 'PREMIUM_TSHIRT' });
    expect(t.tokenKey).toBe('nextToken');
  });

  it('pages with the token until it runs out', () => {
    const next = nextPage(t, {}, capture.payload, 2, 2)!;
    expect(next).toEqual({ token: 'tok-2', tokenName: 'nextToken' });
    const r = buildRequest(t, { page: next });
    expect(JSON.parse(r.body!)).toMatchObject({ pageSize: 2, nextToken: 'tok-2' });
    expect(nextPage(t, next, { products: [{ id: 'p3', title: 'x', status: 'LIVE' }] }, 1, 3)).toBeNull();
  });
});

describe('style D: catalog via GET with page numbers and a total', () => {
  const capture = cap({
    url: 'https://merch.amazon.com/api/manage/products?page=1&pageSize=50&sort=created',
    payload: { totalCount: 120, items: [{ asin: 'B0EEEEEEE1', title: 'Cat Nap Club', status: 'Live', marketplace: 'amazon.com', productType: 'Premium T-shirt', created: 1700000000000 }] },
  });
  const learned = learn(capture);
  const t = learned.template!;

  it('learns page numbers and stops at the total', () => {
    expect(learned.items[0]).toMatchObject({ marketplace: 'US', status: 'live', productType: 'PREMIUM_TSHIRT', createdAt: '2023-11-14' });
    expect(t.pages.map((p) => p.role).sort()).toEqual(['page', 'size']);
    const next = nextPage(t, {}, capture.payload, 50, 50)!;
    expect(next).toEqual({ page: 2 });
    expect(new URL(buildRequest(t, { page: next }).url).searchParams.get('page')).toBe('2');
    expect(nextPage(t, { page: 3 }, capture.payload, 20, 120)).toBeNull();
  });
});

describe('safety and helpers', () => {
  it('never replays writes', () => {
    expect(isSafeToReplay('GET', 'https://merch.amazon.com/api/x')).toBe(true);
    expect(isSafeToReplay('POST', 'https://merch.amazon.com/api/products/search')).toBe(true);
    expect(isSafeToReplay('POST', 'https://merch.amazon.com/api/products/delete')).toBe(false);
    expect(isSafeToReplay('POST', 'https://merch.amazon.com/api/design/publish')).toBe(false);
    expect(isSafeToReplay('DELETE', 'https://merch.amazon.com/api/x')).toBe(false);
    const learned = learn(cap({ url: 'https://merch.amazon.com/api/products/update', method: 'POST', body: '{}', payload: [{ asin: 'B0AAAAAAAA', title: 'x', status: 'LIVE' }] }));
    expect(learned.kind).toBe('catalog');
    expect(learned.template).toBeNull();
  });

  it('ranks dated templates first and chunks ranges newest first', () => {
    const a = learn(cap({ url: 'https://m.test/a?date=2026-10-05&marketplaceId=ATVPDKIKX0DER', payload: [{ asin: 'B0AAAAAAAA', units: 1 }] })).template!;
    const b = learn(cap({ url: 'https://m.test/b?from=2026-10-01&to=2026-10-05&marketplaceId=ATVPDKIKX0DER', payload: [{ asin: 'B0AAAAAAAA', units: 1, date: '2026-10-02' }] })).template!;
    expect(rankTemplates([a, b])[0]!.url).toContain('/b');
    expect(chunks('2026-01-01', '2026-03-15', 31)).toEqual([
      { from: '2026-02-13', to: '2026-03-15' },
      { from: '2026-01-13', to: '2026-02-12' },
      { from: '2026-01-01', to: '2026-01-12' },
    ]);
  });

  it('describes requests and payloads without values', () => {
    const d = describeRequest('GET', 'https://merch.amazon.com/api/r?fromDate=1759302000000&marketplaceId=ATVPDKIKX0DER&q=secret');
    expect(d).toContain('fromDate=<epoch-ms>');
    expect(d).not.toContain('secret');
    const shape = describeShape({ records: [{ asin: 'B0AAAAAAAA', title: 'My secret design', units: 3 }] });
    expect(shape).toEqual(['records: array(1)', 'records[].asin: asin', 'records[].title: string(16)', 'records[].units: number']);
  });

  it('normalizes statuses and finds sales in maps keyed by ASIN or day', () => {
    expect(['LIVE', 'Under review', 'REJECTED', 'TIMED_OUT', 'Draft', 'PROCESSING'].map(normalizeStatus)).toEqual(['live', 'review', 'rejected', 'removed', 'draft', 'processing']);
    const byAsin = normalizeSales({ marketplace: 'US', date: '2026-10-05', sales: { B0AAAAAAAA: { units: 2, royalty: 4.88 } } });
    expect(byAsin.rows[0]).toMatchObject({ asin: 'B0AAAAAAAA', units: 2 });
    const byDay = normalizeSales({ marketplace: 'US', days: { '2026-10-04': [{ asin: 'B0AAAAAAAA', units: 1 }] } });
    expect(byDay.rows[0]).toMatchObject({ date: '2026-10-04' });
    expect(byDay.dated).toBe(true);
    expect(normalizeCatalog({ title: 'Dashboard', status: 'OK' })).toEqual([]);
  });
});

describe('sync report', () => {
  it('describes templates and responses without values, titles or header contents', async () => {
    const { syncReport } = await import('../src/shared/report');
    const capture = cap({
      url: 'https://merch.amazon.com/api/reporting/purchases/records?marketplaceId=ATVPDKIKX0DER&fromDate=1759302000000&toDate=1759906799999',
      headers: { 'anti-csrftoken-a2z': 'SECRET-TOKEN' },
      payload: [{ date: 1759561200000, asin: 'B0AAAAAAAA', title: 'My Secret Design', unitsSold: 2, royalty: { value: 4.88, currencyCode: 'USD' } }],
    });
    const t = learn(capture).template!;
    const text = syncReport({
      version: '1.1.0', userAgent: 'Mozilla/5.0 (X11; Linux) Chrome/140', templates: [t],
      captureLog: [{ path: '/api/reporting/purchases/records', at, rows: 1, items: 0, status: 200, kind: 'sales', template: true, request: 'GET merch.amazon.com/api/x?fromDate=<epoch-ms>', keys: describeShape(capture.payload) }],
      syncState: { status: 'done', mode: 'connect', phase: 'Synced' }, counts: { sales: 1, catalog: 0, totals: 0 }, coverage: null, accountKeys: ['account.tier'],
    });
    expect(text).toContain('Learned templates (1)');
    expect(text).toContain('fromDate=<epoch-ms>');
    expect(text).toContain('header names: anti-csrftoken-a2z');
    expect(text).not.toMatch(/SECRET-TOKEN|My Secret Design|B0AAAAAAAA|4\.88/);
  });
});

describe('telling the real thing from a widget', () => {
  it('keeps an empty sales report as a candidate to verify, not as nothing', () => {
    const empty = learn(cap({ url: 'https://api.merch.amazon.com/v1/analytics/sales?marketplace=US&startDate=2026-10-05&endDate=2026-10-05', payload: { data: { sales: [] } } }));
    expect(empty.kind).toBe('sales');
    expect(empty.template?.rows).toBe(0);
    expect(empty.template?.window).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(isStrongSales(empty.template)).toBe(false);
    // An empty list that isn't a report stays unknown.
    expect(learn(cap({ url: 'https://merch.amazon.com/api/notifications?since=2026-10-05', payload: { items: [] } })).kind).toBe('none');
  });

  it('a dashboard widget with 10 products is not the catalog; a paged list is', () => {
    const products = Array.from({ length: 10 }, (_, i) => ({ asin: `B0AAAAAA${String(i).padStart(2, '0')}`, title: `Design ${i}`, status: 'LIVE', productType: 'STANDARD_TSHIRT' }));
    const widget = learn(cap({ url: 'https://merch.amazon.com/api/dashboard/recent-products', payload: { products } })).template;
    expect(widget?.kind).toBe('catalog');
    expect(isStrongCatalog(widget)).toBe(false);
    const paged = learn(cap({ url: 'https://merch.amazon.com/api/listings?limit=10', payload: { items: products, nextCursor: 'abc' } })).template;
    expect(isStrongCatalog(paged)).toBe(true);
    expect(rankTemplates([widget!, paged!])[0]).toBe(paged);
  });

  it('replays GraphQL queries but never mutations', () => {
    expect(isSafeToReplay('POST', 'https://merch.amazon.com/graphql', '{"query":"query Sales { sales { asin } }"}')).toBe(true);
    expect(isSafeToReplay('POST', 'https://merch.amazon.com/graphql', '{"query":"mutation Delete { deleteDesign(id: 1) }"}')).toBe(false);
  });
});

describe('reports of totals for a date range (no date on each row)', () => {
  const from = zonedToEpoch(2026, 9, 6);
  const to = zonedToEpoch(2026, 10, 5, 23, 59, 59, 999);
  const capture = cap({
    url: `https://merch.amazon.com/api/reporting/purchases/report?marketplaceId=ATVPDKIKX0DER&fromDate=${from}&toDate=${to}`,
    payload: [
      { asin: 'B0AAAAAAAA', productType: 'STANDARD_TSHIRT', unitsSold: 41, unitsCancelled: 1, unitsReturned: 0, royalty: { value: 100.04, unit: 'USD' } },
      { asin: 'B0BBBBBBBB', productType: 'HOODIE', unitsSold: 3, unitsCancelled: 0, unitsReturned: 0, royalty: { value: 21.3, unit: 'USD' } },
    ],
  });
  const learned = learn(capture);

  it('learns them as a sales template without storing a month of sales as one day', () => {
    expect(learned.kind).toBe('sales');
    expect(learned.rows).toEqual([]);
    expect(learned.totals).toBe(2);
    expect(learned.template?.rows).toBe(2);
    expect(learned.template?.dated).toBe(false);
    expect(isStrongSales(learned.template)).toBe(true);
  });

  it('asked for one day, the same report gives daily rows', () => {
    const t = learned.template!;
    const day = buildRequest(t, { from: '2026-10-04', to: '2026-10-04' });
    const daily = learn(cap({ url: day.url, payload: capture.payload }));
    expect(daily.rows.map((r) => [r.date, r.asin, r.units, r.currency])).toEqual([
      ['2026-10-04', 'B0AAAAAAAA', 41, 'USD'],
      ['2026-10-04', 'B0BBBBBBBB', 3, 'USD'],
    ]);
  });

  it('reads name/value pair rows and ASINs under unfamiliar keys', () => {
    const rows = normalizeSales(
      {
        results: [
          { dimensions: [{ name: 'parentAsin', value: 'B0CCCCCCCC' }, { name: 'marketplace', value: 'ATVPDKIKX0DER' }], metrics: [{ name: 'netUnits', value: 5 }, { name: 'royaltyAmount', value: 12.2 }] },
        ],
      },
      'https://merch.amazon.com/x',
      { date: '2026-10-04', dateSource: 'url' },
    ).rows;
    expect(rows.map((r) => [r.asin, r.marketplace, r.units, r.royalty])).toEqual([['B0CCCCCCCC', 'US', 5, 12.2]]);
  });
});

describe("Merch's FindListings search service", () => {
  const url = 'https://merch.amazon.com/api/ng-amazon/coral/com.amazon.merch.search.MerchSearchService/FindListings';
  const body = JSON.stringify({ pageSize: 10, sortField: 'updatedDate', status: ['DRAFT', 'LIVE', 'PUBLISHING'], accountId: '4170000123', __type: 'com.amazon.merch.search#FindListingsRequest' });
  const listing = (i: number, status: string, asin: string) => ({
    asin, brandName: 'Brand', createdDate: zonedToEpoch(2026, 1, 1), currencyCode: 'USD', deleteReasonType: '', designId: `d-${i}`, listPrice: 19.99,
    listingId: `listing-${i}`.padEnd(48, '0'), lockReasonType: '', marketplace: 'US', productImageUrn: 'urn:x', productTitle: `Design ${i}`, productType: 'STANDARD_TSHIRT',
    searchableOnRetail: true, status, updatedDate: 1791287012145 - i,
  });
  const payload = { __type: 'x', hitCount: 6017, pageToken: ['1791287012136', 'listing-9'], results: [listing(0, 'PUBLISHING', ''), listing(1, 'LIVE', 'B0AAAAAAAA'), listing(2, 'PROPAGATED', 'B0BBBBBBBB')] };
  const learned = learn(cap({ url, method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 't' }, payload }));

  it('learns a paged product list with listing ids and statuses', () => {
    expect(learned.kind).toBe('catalog');
    expect(learned.template?.tokenKey).toBe('pageToken');
    expect(isStrongCatalog(learned.template)).toBe(true);
    expect(learned.items.map((i) => [i.key.slice(0, 10), i.asin, i.status])).toEqual([
      ['L:listing-', null, 'processing'],
      ['L:listing-', 'B0AAAAAAAA', 'live'],
      ['L:listing-', 'B0BBBBBBBB', 'processing'],
    ]);
  });

  it('asks for the next page with the search-after pair, and stops at hitCount', () => {
    const t = learned.template!;
    const next = nextPage(t, {}, payload, 3, 3)!;
    expect(next.token).toEqual(['1791287012136', 'listing-9']);
    const req = buildRequest(t, { page: next });
    expect(JSON.parse(req.body!).pageToken).toEqual(['1791287012136', 'listing-9']);
    expect(nextPage(t, next, payload, 3, 6017)).toBeNull();
    // A template learned before array tokens were understood still pages.
    const legacy = { ...t, tokenKey: null };
    const n2 = nextPage(legacy, {}, payload, 3, 3)!;
    expect(JSON.parse(buildRequest(legacy, { page: n2 }).body!).pageToken).toEqual(['1791287012136', 'listing-9']);
  });

  it('an earnings report that lists ASINs for a date range is not the product list', () => {
    const e = learn(cap({
      url: `https://merch.amazon.com/api/reporting/earnings/report?marketplaceId=ATVPDKIKX0DER&fromDate=${zonedToEpoch(2026, 9, 7)}&toDate=${zonedToEpoch(2026, 10, 6, 23, 59, 59, 999)}`,
      payload: [{ asin: 'B0AAAAAAAA', productTitle: 'Design', productType: 'STANDARD_TSHIRT', payoutStatus: 'PENDING' }],
    }));
    expect(e.items).toEqual([]);
    expect(e.kind).not.toBe('catalog');
    expect(isCatalogSource({ ...learned.template!, window: { from: '2026-09-07', to: '2026-10-06' } })).toBe(false);
  });

  it('reads the tier from the rate limiter and keeps ids out of response shapes', () => {
    const r = learn(cap({ url: 'https://merch.amazon.com/api/ratelimiter/metadata', payload: { dailyProduct: { count: 4, limit: 100 }, overallProduct: { count: 5628, limit: 8000 }, overallDesign: { count: 984, limit: 1000 } } }));
    expect(r.account?.tier).toBe(1000);
    expect(r.account?.facts['overallDesign.count']).toBe(984);
    const shape = describeShape({ urls: { '610c211f-2d3c-4e06-8785-1bb08b4bcb9f_STANDARD_TSHIRT_US': { size: 1 }, 'a85c8263-d34e-4e66-b02d-6bd54bedd246_HOODIE_US': { size: 2 } } });
    expect(shape).toEqual(['urls.<id>.size: number']);
  });
});
