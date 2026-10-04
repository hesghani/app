import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLooseDate } from '../src/shared/dates';
import { parseAsinFromUrl, parseProductDocument, parseRanks, cleanBrand, isCaptchaPage } from '../src/shared/parse-product';
import { parseResultCount, readCards, readResultCount } from '../src/shared/parse-search';
import { parsePrice, parseInteger, parseRating } from '../src/shared/text';

const fixture = (name: string) =>
  new DOMParser().parseFromString(readFileSync(join(__dirname, 'fixtures', name), 'utf8'), 'text/html');

describe('parseRanks', () => {
  it('reads US detail bullets with sub-categories', () => {
    expect(
      parseRanks(
        "Best Sellers Rank: #48,213 in Clothing, Shoes & Jewelry (See Top 100 in Clothing, Shoes & Jewelry) #112 in Men's Novelty T-Shirts #390 in Women's Novelty T-Shirts",
      ),
    ).toEqual([
      { rank: 48213, category: 'Clothing, Shoes & Jewelry' },
      { rank: 112, category: "Men's Novelty T-Shirts" },
      { rank: 390, category: "Women's Novelty T-Shirts" },
    ]);
  });

  it('reads UK ranks without a # sign', () => {
    expect(parseRanks('Best Sellers Rank: 1,107,489 in Fashion (See Top 100 in Fashion) 2,345 in Men\'s T-Shirts')).toEqual([
      { rank: 1107489, category: 'Fashion' },
      { rank: 2345, category: "Men's T-Shirts" },
    ]);
  });

  it('reads German, French, Italian and Spanish formats', () => {
    expect(parseRanks('Amazon Bestseller-Rang: Nr. 152.004 in Fashion (Siehe Top 100 in Fashion) Nr. 1.534 in Herren T-Shirts')[0]).toEqual({
      rank: 152004,
      category: 'Fashion',
    });
    expect(parseRanks("Classement des meilleures ventes d'Amazon : 98 765 en Mode (Voir les 100 premiers en Mode) 4 321 en T-shirts homme")).toEqual([
      { rank: 98765, category: 'Mode' },
      { rank: 4321, category: 'T-shirts homme' },
    ]);
    expect(parseRanks('Posizione nella classifica Bestseller di Amazon: n. 23.456 in Moda (Visualizza i Top 100 nella categoria Moda) n. 789 in T-shirt da uomo')).toEqual([
      { rank: 23456, category: 'Moda' },
      { rank: 789, category: 'T-shirt da uomo' },
    ]);
    expect(parseRanks('Clasificación en los más vendidos de Amazon: nº45.678 en Moda (Ver el Top 100 en Moda) nº1.234 en Camisetas de hombre')).toEqual([
      { rank: 45678, category: 'Moda' },
      { rank: 1234, category: 'Camisetas de hombre' },
    ]);
  });

  it('reads Japanese ranks', () => {
    expect(parseRanks('Amazon 売れ筋ランキング: - 12,345位ファッション (ファッションの売れ筋ランキングを見る) - 678位メンズTシャツ')).toEqual([
      { rank: 12345, category: 'ファッション' },
      { rank: 678, category: 'メンズTシャツ' },
    ]);
  });

  it('stops before the customer reviews line', () => {
    const ranks = parseRanks('Best Sellers Rank: #5,000 in Clothing, Shoes & Jewelry Customer Reviews: 4.6 out of 5 stars 120 ratings');
    expect(ranks).toEqual([{ rank: 5000, category: 'Clothing, Shoes & Jewelry' }]);
  });
});

describe('parseLooseDate', () => {
  it.each([
    ['March 3, 2024', '2024-03-03'],
    ['3 Mar. 2024', '2024-03-03'],
    ['14. Februar 2023', '2023-02-14'],
    ['3. März 2023', '2023-03-03'],
    ['1 juil. 2022', '2022-07-01'],
    ['12 juin 2022', '2022-06-12'],
    ['5 febbraio 2021', '2021-02-05'],
    ['20 septiembre 2020', '2020-09-20'],
    ['2023/3/3', '2023-03-03'],
    ['2023年11月5日', '2023-11-05'],
    ['déc. 24 2019', '2019-12-24'],
  ])('%s → %s', (input, expected) => {
    expect(parseLooseDate(input)).toBe(expected);
  });

  it('rejects text without a date', () => {
    expect(parseLooseDate('no date here')).toBeNull();
    expect(parseLooseDate('February 30, 2023')).toBeNull();
  });
});

describe('number parsing', () => {
  it('parses prices in every format', () => {
    expect(parsePrice('$19.99')).toBe(19.99);
    expect(parsePrice('17,99 €')).toBe(17.99);
    expect(parsePrice('£1,299.00')).toBe(1299);
    expect(parsePrice('￥2,980')).toBe(2980);
    expect(parsePrice('1.234,50 €')).toBe(1234.5);
    expect(parsePrice('')).toBeNull();
  });

  it('parses counts and ratings', () => {
    expect(parseInteger('1,284 ratings')).toBe(1284);
    expect(parseInteger('87 Sternebewertungen')).toBe(87);
    expect(parseRating('4.7 out of 5 stars')).toBe(4.7);
    expect(parseRating('4,4 von 5 Sternen')).toBe(4.4);
  });
});

describe('parseProductDocument', () => {
  it('reads a US Merch listing', () => {
    const p = parseProductDocument(fixture('product-us.html'), 'US');
    expect(p).toMatchObject({
      asin: 'B0CXYZ1234',
      title: 'Retro Pickleball Legend Funny Paddle Player T-Shirt',
      brand: 'Dinkworthy',
      price: 19.99,
      currency: 'USD',
      rating: 4.7,
      reviews: 1284,
      bsr: 48213,
      bsrCategory: 'Clothing, Shoes & Jewelry',
      firstAvailable: '2024-03-03',
      merch: 'yes',
      productType: 'STANDARD_TSHIRT',
      soldByAmazon: true,
      image: 'https://m.media-amazon.com/images/I/A1large.jpg',
    });
    expect(p.subRanks).toEqual([
      { rank: 112, category: "Men's Novelty T-Shirts" },
      { rank: 390, category: "Women's Novelty T-Shirts" },
    ]);
    expect(p.bullets).toHaveLength(5);
  });

  it('reads a German listing with the table layout', () => {
    const p = parseProductDocument(fixture('product-de.html'), 'DE');
    expect(p).toMatchObject({
      asin: 'B0DEUTSCH1',
      brand: 'Katzenkaffee Design',
      price: 17.99,
      currency: 'EUR',
      rating: 4.4,
      reviews: 87,
      bsr: 152004,
      bsrCategory: 'Fashion',
      firstAvailable: '2023-02-14',
      merch: 'yes',
    });
    expect(p.subRanks).toEqual([{ rank: 1534, category: 'Herren T-Shirts' }]);
  });

  it('cleans brand bylines', () => {
    expect(cleanBrand('Visit the Funny Cat Store')).toBe('Funny Cat');
    expect(cleanBrand('Brand: Dinkworthy')).toBe('Dinkworthy');
    expect(cleanBrand('Besuche den Katzen-Store')).toBe('Katzen');
  });

  it('extracts ASINs from URLs and spots captchas', () => {
    expect(parseAsinFromUrl('https://www.amazon.com/Retro-Pickleball/dp/B0CXYZ1234/ref=sr_1_1?k=x')).toBe('B0CXYZ1234');
    expect(parseAsinFromUrl('https://www.amazon.de/gp/product/B0DEUTSCH1')).toBe('B0DEUTSCH1');
    expect(parseAsinFromUrl('https://www.amazon.com/s?k=dp')).toBeNull();
    expect(isCaptchaPage('<form action="/errors/validateCaptcha">')).toBe(true);
    expect(isCaptchaPage('<html>normal</html>')).toBe(false);
  });
});

describe('search pages', () => {
  it('reads cards, skipping duplicates and blanks, and flags sponsored results', () => {
    const cards = readCards(fixture('search-us.html'));
    expect(cards.map((c) => c.asin)).toEqual(['B0CXYZ1234', 'B0SPONSOR1']);
    expect(cards[0]).toMatchObject({ price: 19.99, rating: 4.7, reviews: 1284, sponsored: false });
    expect(cards[1]).toMatchObject({ price: 34.99, sponsored: true });
  });

  it('reads the result count in several languages', () => {
    expect(readResultCount(fixture('search-us.html'))).toBe(3000);
    expect(parseResultCount('1-48 von mehr als 50.000 Ergebnissen')).toBe(50000);
    expect(parseResultCount('1 à 48 sur plus de 20 000 résultats')).toBe(20000);
    expect(parseResultCount('12 results for')).toBe(12);
  });
});

describe('layout fallbacks', () => {
  it('finds BSR and date in an unfamiliar product details layout', () => {
    const doc = new DOMParser().parseFromString(`
      <span id="productTitle">Cat Tee</span>
      <div id="newDetailsAccordion"><table>
        <tr><th>Best Sellers Rank</th><td>#9,876 in Clothing, Shoes &amp; Jewelry (See Top 100) #12 in Women's Novelty Tops</td></tr>
        <tr><th>Date First Available</th><td>January 5, 2026</td></tr>
      </table></div>`, 'text/html');
    const p = parseProductDocument(doc, 'US', 'B0CAT00001');
    expect(p.bsr).toBe(9876);
    expect(p.subRanks).toEqual([{ rank: 12, category: "Women's Novelty Tops" }]);
    expect(p.firstAvailable).toBe('2026-01-05');
  });

  it('falls back to page text for the rank', () => {
    const doc = new DOMParser().parseFromString(
      '<span id="productTitle">Cat Tee</span><div><p>Best Sellers Rank: #321,000 in Clothing, Shoes &amp; Jewelry</p></div>',
      'text/html',
    );
    expect(parseProductDocument(doc, 'US', 'B0CAT00002').bsr).toBe(321000);
  });
});
