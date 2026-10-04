import { salesPerDay, salesPerMonth, heat, formatMonthly } from '../src/shared/bsr';
import { DEFAULT_ROYALTY_MODEL, estimateRoyalty, royaltyAllTiers, calibrateCost, breakEvenPrice } from '../src/shared/royalty';
import { scanText, phrasesToCheck } from '../src/shared/trademark';
import { extractKeywords, parseSuggestions } from '../src/shared/keywords';
import { marketplaceFromAny, marketplaceFromHost, merchSearchUrl } from '../src/shared/marketplaces';
import { detectProductType, productTypeFromLabel, defaultPrice } from '../src/shared/products';
import { nicheScore, summarizeNiche } from '../src/shared/niche';
import { detectMerch } from '../src/shared/merch-detect';
import { resolveRange, previousRange } from '../src/shared/dates';
import { parseCsv, toCsv } from '../src/shared/csv';
import { withDefaults } from '../src/shared/settings';
import type { ProductData } from '../src/shared/types';

describe('BSR model', () => {
  it('falls as rank rises and hits the anchors', () => {
    expect(salesPerDay(100_000)).toBeCloseTo(1.2, 5);
    expect(salesPerDay(10_000)).toBeCloseTo(11, 5);
    let previous = Infinity;
    for (const rank of [1, 50, 900, 7_000, 60_000, 300_000, 2_500_000, 20_000_000]) {
      const v = salesPerDay(rank)!;
      expect(v).toBeLessThanOrEqual(previous);
      previous = v;
    }
    expect(salesPerDay(null)).toBeNull();
  });

  it('scales smaller marketplaces down', () => {
    expect(salesPerMonth(50_000, 'DE')!).toBeLessThan(salesPerMonth(50_000, 'US')!);
  });

  it('labels heat and formats monthly sales', () => {
    expect(heat(5_000)).toBe('hot');
    expect(heat(80_000)).toBe('good');
    expect(heat(400_000)).toBe('ok');
    expect(heat(1_000_000)).toBe('slow');
    expect(heat(4_000_000)).toBe('cold');
    expect(heat(null)).toBe('none');
    expect(formatMonthly(0.4)).toBe('<1/mo');
    expect(formatMonthly(1.54)).toBe('≈1.5/mo');
    expect(formatMonthly(36.2)).toBe('≈36/mo');
  });
});

describe('royalty model', () => {
  it('reproduces the published $19.99 Standard T-shirt royalties', () => {
    expect(royaltyAllTiers(DEFAULT_ROYALTY_MODEL, 'STANDARD_TSHIRT', 'US', 19.99)).toEqual({ creator: 2.44, plus: 4.88, premium: 5.27 });
  });

  it('removes VAT in European marketplaces and never goes negative', () => {
    const us = estimateRoyalty(DEFAULT_ROYALTY_MODEL, 'STANDARD_TSHIRT', 'US', 19.99, 'creator');
    const de = estimateRoyalty(DEFAULT_ROYALTY_MODEL, 'STANDARD_TSHIRT', 'DE', 19.99, 'creator');
    expect(de).toBeLessThan(us);
    expect(estimateRoyalty(DEFAULT_ROYALTY_MODEL, 'HOODIE', 'US', 5, 'premium')).toBe(0);
  });

  it('calibrates the production cost from an observed royalty', () => {
    const cost = calibrateCost(DEFAULT_ROYALTY_MODEL, 'US', 24.99, 'creator', 3.1);
    const model = { ...DEFAULT_ROYALTY_MODEL, costOverrides: { LONG_SLEEVE: { US: cost } } };
    expect(estimateRoyalty(model, 'LONG_SLEEVE', 'US', 24.99, 'creator')).toBeCloseTo(3.1, 1);
    expect(estimateRoyalty(model, 'LONG_SLEEVE', 'US', breakEvenPrice(model, 'LONG_SLEEVE', 'US'), 'creator')).toBeLessThan(0.02);
  });
});

describe('trademark scan', () => {
  it('finds brands, protected terms and policy problems, worst first', () => {
    const hits = scanText({
      title: 'Funny Spiderman Olympic Pickleball Tee',
      bullets: 'Best seller! Free shipping and 100% officially licensed. Visit www.example.com',
    });
    const terms = hits.map((h) => h.term);
    expect(terms).toEqual(expect.arrayContaining(['Spider-Man', 'Olympic', 'best seller', 'free shipping', 'officially licensed', 'URL or email']));
    expect(terms).not.toContain('official');
    expect(terms).not.toContain('licensed');
    expect(hits[0]!.severity).toBe('high');
    expect(hits.find((h) => h.term === 'Spider-Man')!.field).toBe('title');
  });

  it('matches whole words only and honours custom and ignored terms', () => {
    expect(scanText({ title: 'Nikes are not a word but Nike is' }).map((h) => h.term)).toEqual(['Nike']);
    expect(scanText({ title: 'Pineapple lover' })).toEqual([]);
    expect(scanText({ title: 'Dink Responsibly' }, { custom: ['dink responsibly'] })[0]).toMatchObject({ kind: 'custom' });
    expect(scanText({ title: 'Nike' }, { ignore: ['nike'] })).toEqual([]);
  });

  it('suggests phrases to look up', () => {
    expect(phrasesToCheck('Dinkworthy', 'Retro Pickleball Legend - Funny Paddle Player T-Shirt')).toEqual([
      'dinkworthy', 'retro pickleball legend', 'paddle player',
    ]);
  });
});

describe('keywords', () => {
  it('ranks design phrases above product words', () => {
    const keywords = extractKeywords([
      { text: 'Retro Pickleball Legend Funny Paddle Player T-Shirt', weight: 3 },
      { text: 'Retro pickleball design for dink masters and pickleball legends', weight: 1 },
    ]).map((k) => k.phrase);
    expect(keywords.slice(0, 3)).toContain('retro pickleball legend');
    expect(keywords).not.toContain('t');
    expect(keywords).not.toContain('shirt');
    expect(keywords).not.toContain('funny');
  });

  it('parses both suggestion API shapes', () => {
    expect(parseSuggestions({ suggestions: [{ value: 'cat shirt' }, { value: 'cat mom' }] })).toEqual(['cat shirt', 'cat mom']);
    expect(parseSuggestions(['cat', ['cat toys', 'cat tree']])).toEqual(['cat toys', 'cat tree']);
    expect(parseSuggestions('nope')).toEqual([]);
  });
});

describe('marketplaces and product types', () => {
  it('resolves marketplaces from hosts, IDs and names', () => {
    expect(marketplaceFromHost('www.amazon.co.uk')).toBe('UK');
    expect(marketplaceFromHost('smile.amazon.com')).toBeNull();
    expect(marketplaceFromAny('ATVPDKIKX0DER')).toBe('US');
    expect(marketplaceFromAny('Amazon.de')).toBe('DE');
    expect(marketplaceFromAny('Germany')).toBe('DE');
    expect(marketplaceFromAny('GB')).toBe('UK');
    expect(marketplaceFromAny('ja_JP')).toBe('JP');
    expect(marketplaceFromAny('Mars')).toBeNull();
  });

  it('builds Merch search URLs', () => {
    const us = new URL(merchSearchUrl('US', 'pickleball dad'));
    expect(us.hostname).toBe('www.amazon.com');
    expect(us.searchParams.get('k')).toBe('pickleball dad');
    expect(us.searchParams.get('hidden-keywords')).toContain('Double-needle');
    expect(new URL(merchSearchUrl('DE', 'katze')).searchParams.get('hidden-keywords')).toContain('doppelt');
    expect(merchSearchUrl('US', 'a b', 'https://x.test/s?q={keyword}')).toBe('https://x.test/s?q=a%20b');
  });

  it('detects product types', () => {
    expect(detectProductType('Funny Cat Pullover Hoodie')).toBe('HOODIE');
    expect(detectProductType('Funny Cat Zip Hoodie')).toBe('ZIP_HOODIE');
    expect(detectProductType('Cat Premium T-Shirt')).toBe('PREMIUM_TSHIRT');
    expect(detectProductType('Cat T-Shirt')).toBe('STANDARD_TSHIRT');
    expect(detectProductType('Katze Kapuzenpullover')).toBe('HOODIE');
    expect(detectProductType('Cat PopSockets Swappable PopGrip')).toBe('POPSOCKET');
    expect(productTypeFromLabel('STANDARD_TSHIRT')).toBe('STANDARD_TSHIRT');
    expect(productTypeFromLabel('Pullover Hoodie')).toBe('HOODIE');
    expect(defaultPrice('STANDARD_TSHIRT', 'US')).toBe(19.99);
    expect(defaultPrice('STANDARD_TSHIRT', 'JP')).toBe(2980);
  });

  it('detects Merch listings', () => {
    expect(detectMerch({ title: 'Cat Tee', bullets: ['Lightweight, Classic fit, Double-needle sleeve and bottom hem'] })).toBe('yes');
    expect(detectMerch({ title: 'Gildan Heavy Cotton', bullets: ['Double-needle sleeve and bottom hem'], soldByAmazon: false })).toBe('likely');
    expect(detectMerch({ title: 'Blender', bullets: ['1200 watts'] })).toBe('no');
  });
});

describe('niche score', () => {
  const product = (bsr: number | null, firstAvailable: string | null): ProductData => ({
    asin: 'B0AAAAAAAA', marketplace: 'US', title: 't', brand: 'b', price: 19.99, currency: 'USD', rating: 4.5, reviews: 10,
    bsr, bsrCategory: 'Clothing', subRanks: [], firstAvailable, bullets: [], description: '', merch: 'yes',
    productType: 'STANDARD_TSHIRT', image: null, soldByAmazon: true, fetchedAt: 0,
  });

  it('prefers strong demand, little competition and young sellers', () => {
    const great = nicheScore({ medianBsr: 30_000, totalResults: 400, medianAgeDays: 90, under100kShare: 0.8 });
    const poor = nicheScore({ medianBsr: 2_000_000, totalResults: 90_000, medianAgeDays: 1500, under100kShare: 0 });
    expect(great).toBeGreaterThan(80);
    expect(poor).toBeLessThan(15);
  });

  it('summarizes sampled products', () => {
    const now = Date.parse('2026-10-04T12:00:00');
    const result = summarizeNiche('pickleball', 'US', 3000, [product(40_000, '2026-04-01'), product(200_000, '2025-01-01'), product(null, null)], now);
    expect(result).toMatchObject({ sampled: 3, medianBsr: 120_000, under100k: 1, totalResults: 3000 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('misc', () => {
  it('resolves date ranges', () => {
    expect(resolveRange('7d', '2026-10-04')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(resolveRange('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(resolveRange('month', '2026-10-04')).toEqual({ from: '2026-10-01', to: '2026-10-04' });
    expect(previousRange({ from: '2026-09-28', to: '2026-10-04' })).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });

  it('round-trips CSV', () => {
    const rows = [['a', 'b,c', 'say "hi"'], ['1', '', 'line\nbreak']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('fills in settings added later', () => {
    const s = withDefaults({ marketplace: 'DE', fx: { USD: 1, EUR: 1.2, GBP: 1.3, JPY: 0.007 } });
    expect(s.marketplace).toBe('DE');
    expect(s.fx.EUR).toBe(1.2);
    expect(s.royalty.tierMultipliers.plus).toBe(2);
    expect(s.heat.good).toBe(100_000);
  });
});

describe('replay', () => {
  it('moves date parameters forward with the calendar', async () => {
    const { shiftDateParams } = await import('../src/shared/replay');
    const captured = new Date(2026, 9, 1, 12).getTime();
    const now = new Date(2026, 9, 4, 9).getTime();
    const url = 'https://merch.amazon.com/api/x?from=2026-09-25&to=2026-10-01T23:59:59Z&ts=1759320000000&page=2';
    const shifted = new URL(shiftDateParams(url, captured, now));
    expect(shifted.searchParams.get('from')).toBe('2026-09-28');
    expect(shifted.searchParams.get('to')).toBe('2026-10-04T23:59:59Z');
    expect(shifted.searchParams.get('ts')).toBe(String(1759320000000 + 3 * 86_400_000));
    expect(shifted.searchParams.get('page')).toBe('2');
    expect(shiftDateParams(url, now, now)).toBe(url);
  });
});

describe('keyword noise', () => {
  it('ignores Merch stock bullets and bare numbers but keeps years', async () => {
    const { extractKeywords } = await import('../src/shared/keywords');
    const phrases = extractKeywords([
      { text: 'Solid colors: 100% Cotton; Heather Grey: 90% Cotton, 10% Polyester; All Other Heathers: 50% Cotton, 50% Polyester', weight: 1 },
      { text: 'Vintage 1985 Birthday Legend 40 Years', weight: 3 },
    ]).map((k) => k.phrase);
    expect(phrases.some((p) => p.includes('cotton'))).toBe(false);
    expect(phrases.some((p) => p.includes('1985'))).toBe(true);
    expect(phrases.some((p) => /\b40\b/.test(p))).toBe(false);
  });
});
