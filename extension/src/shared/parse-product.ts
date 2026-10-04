// Reads an Amazon product page (live, or fetched and parsed with DOMParser).
// Selectors cover the desktop layouts Amazon has used for apparel since 2021,
// and every label is matched in all seven Merch marketplace languages.

import { parseLooseDate } from './dates';
import { MARKETPLACES, type MarketplaceId } from './marketplaces';
import { detectMerch } from './merch-detect';
import { detectProductType } from './products';
import { clean, parseInteger, parsePrice, parseRating } from './text';
import type { ProductData, RankEntry } from './types';

const BSR_LABEL =
  /best\s?sellers?\s?rank|bestseller-?rang|classement des meilleures ventes|posizione nella classifica bestseller|clasificación en los más vendidos|売れ筋ランキング/i;
const DATE_LABEL =
  /date first available|im angebot von amazon\.\w+ seit|erhältlich seit|date de mise en ligne|disponibile su amazon\.\w+ a partire dal|producto en amazon\.\w+ desde|取り扱い開始日/i;
const STOP_LABEL =
  /customer reviews|kundenrezensionen|commentaires client|recensioni dei clienti|opiniones de los clientes|カスタマーレビュー|date first available|is discontinued|manufacturer|product dimensions/i;

const DETAIL_CONTAINERS = [
  '#detailBullets_feature_div',
  '#detailBulletsWrapper_feature_div',
  '#productDetails_detailBullets_sections1',
  '#productDetails_db_sections',
  '#productDetails_techSpec_section_1',
  '#productDetails_feature_div',
  '#prodDetails',
  '#detail-bullets',
  '#detailBullets',
];

/** Label → value pairs from both the bullet-list and table layouts of "Product details". */
export function detailPairs(doc: ParentNode): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<Element>();
  for (const sel of DETAIL_CONTAINERS) {
    for (const container of Array.from(doc.querySelectorAll(sel))) {
      for (const li of Array.from(container.querySelectorAll('li'))) {
        if (seen.has(li)) continue;
        seen.add(li);
        const bold = li.querySelector('.a-text-bold');
        if (!bold) continue;
        const label = clean(bold.textContent).replace(/[:：]\s*$/, '').trim();
        const value = clean(li.textContent).slice(clean(bold.textContent).length).replace(/^[\s:：]+/, '');
        if (label) pairs.push([label, value]);
      }
      for (const tr of Array.from(container.querySelectorAll('tr'))) {
        if (seen.has(tr)) continue;
        seen.add(tr);
        const th = tr.querySelector('th');
        const td = tr.querySelector('td');
        if (th && td) pairs.push([clean(th.textContent), clean(td.textContent)]);
      }
    }
  }
  return pairs;
}

const anywhereCache = new WeakMap<ParentNode, Array<[string, string]>>();

/** Label/value pairs from any table row or bold-labelled list item on the page. */
function anywherePairs(doc: ParentNode): Array<[string, string]> {
  const cached = anywhereCache.get(doc);
  if (cached) return cached;
  const pairs: Array<[string, string]> = [];
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const th = tr.querySelector('th');
    const td = tr.querySelector('td');
    if (th && td) pairs.push([clean(th.textContent), clean(td.textContent)]);
  }
  for (const li of Array.from(doc.querySelectorAll('li'))) {
    const bold = li.querySelector('.a-text-bold, b, strong');
    if (!bold) continue;
    const label = clean(bold.textContent);
    pairs.push([label.replace(/[:：]\s*$/, ''), clean(li.textContent).slice(label.length).replace(/^[\s:：]+/, '')]);
  }
  anywhereCache.set(doc, pairs);
  return pairs;
}

function detailsText(doc: ParentNode): string {
  return DETAIL_CONTAINERS.map((sel) => doc.querySelector(sel)?.textContent ?? '')
    .map(clean)
    .join(' | ');
}

const RANK_PATTERN = /(?:^|[\s|¦:#]|Nr\.|n\.\s?º?|nº|N\.º)\s*(\d{1,3}(?:[.,\s]\d{3})+|\d+)\s+(?:in|en|dans)\s+/gi;
const JP_RANK_PATTERN = /(\d{1,3}(?:,\d{3})+|\d+)\s*位\s*/g;

/**
 * Extracts ranks from text such as
 * "#12,345 in Clothing, Shoes & Jewelry (See Top 100…) #567 in Men's Novelty T-Shirts".
 * The first entry is the top-level category rank.
 */
export function parseRanks(input: string): RankEntry[] {
  let text = clean(input);
  const label = text.match(BSR_LABEL);
  if (label?.index !== undefined) text = text.slice(label.index + label[0].length);
  const stop = text.match(STOP_LABEL);
  if (stop?.index !== undefined && stop.index > 0) text = text.slice(0, stop.index);
  text = text.slice(0, 900).replace(/\([^)]*\)/g, ' ¦ ');

  const pattern = /位/.test(text) ? JP_RANK_PATTERN : RANK_PATTERN;
  const matches = Array.from(text.matchAll(new RegExp(pattern.source, pattern.flags)));
  const ranks: RankEntry[] = [];
  matches.forEach((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[i + 1]?.index ?? text.length;
    const category = text
      .slice(start, end)
      .split('¦')[0]!
      .replace(/(?:#|Nr\.|n\.\s?º?|nº|N\.º|[-－|:])\s*$/i, '')
      .trim();
    const rank = parseInteger(match[1]);
    if (rank && category && category.length < 120) ranks.push({ rank, category });
  });
  return ranks;
}

export function parseAsinFromUrl(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
  return m ? m[1]!.toUpperCase() : null;
}

function text(doc: ParentNode, ...selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const value = clean(el?.textContent);
    if (value) return value;
  }
  return '';
}

/** "Visit the Funny Cat Store" / "Brand: X" / "Besuche den X-Store" → brand name. */
export function cleanBrand(raw: string): string {
  return clean(raw)
    .replace(/^(?:visit the|besuche den|visitez la boutique|visita lo store di|visita la tienda de|ブランド[:：]?)\s*/i, '')
    .replace(/^(?:brand|marke|marque|marca)\s*[:：]\s*/i, '')
    .replace(/[\s-]*(?:store|boutique|tienda|のストアを表示)$/i, '')
    .replace(/-Store$/i, '')
    .trim();
}

export function parseProductDocument(doc: Document, mp: MarketplaceId, fallbackAsin?: string, url?: string): ProductData {
  const asin =
    (doc.querySelector<HTMLInputElement>('input#ASIN, input[name="ASIN"]')?.value ?? '').toUpperCase() ||
    (url ? parseAsinFromUrl(url) : null) ||
    fallbackAsin ||
    '';

  const title = text(doc, '#productTitle', '#title', 'h1');
  const brand = cleanBrand(text(doc, '#bylineInfo', '#brand', 'a#bylineInfo_feature_div'));
  const priceText =
    text(
      doc,
      '#corePrice_feature_div .a-price .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#apex_desktop .a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox',
      '.a-price .a-offscreen',
    ) || text(doc, '#corePrice_feature_div .a-price', '.a-price');
  const rating = parseRating(
    doc.querySelector('#acrPopover')?.getAttribute('title') ?? text(doc, '#acrPopover', 'i.a-icon-star span'),
  );
  const reviews = parseInteger(text(doc, '#acrCustomerReviewText', '#acrCustomerReviewLink'));

  const bullets = Array.from(
    doc.querySelectorAll('#feature-bullets li, #productFactsDesktopExpander li, #productFactsDesktop_feature_div li'),
  )
    .map((li) => clean(li.textContent))
    .filter((t, i, all) => t && all.indexOf(t) === i && !/^(?:›|see more|mehr anzeigen)/i.test(t));

  const description = text(doc, '#productDescription', '#aplus');
  const pairs = detailPairs(doc);

  // Amazon moves "Product details" between layouts; if the known containers
  // don't have the labels, look at every labelled row on the page.
  const findPair = (label: RegExp) => pairs.find(([l]) => label.test(l)) ?? anywherePairs(doc).find(([l]) => label.test(l));

  let ranks: RankEntry[] = [];
  const bsrPair = findPair(BSR_LABEL);
  if (bsrPair) ranks = parseRanks(bsrPair[1]);
  if (!ranks.length) {
    const salesRank = text(doc, '#SalesRank', '#detailBulletsWrapper_feature_div') || detailsText(doc);
    ranks = parseRanks(BSR_LABEL.test(salesRank) ? salesRank : clean(doc.body?.textContent));
  }

  const datePair = findPair(DATE_LABEL);
  let firstAvailable = datePair ? parseLooseDate(datePair[1]) : null;
  if (!firstAvailable) {
    const all = detailsText(doc);
    const m = all.match(DATE_LABEL);
    if (m?.index !== undefined) firstAvailable = parseLooseDate(all.slice(m.index + m[0].length, m.index + m[0].length + 40));
  }

  const merchantText = text(
    doc,
    '#merchantInfoFeature_feature_div',
    '#merchant-info',
    '#tabular-buybox',
    '#sellerProfileTriggerId',
    '#offerDisplayFeatures_desktop',
  );
  const soldByAmazon = /amazon/i.test(merchantText);

  const image =
    doc.querySelector<HTMLImageElement>('#landingImage, #imgBlkFront, #main-image')?.getAttribute('data-old-hires') ||
    doc.querySelector<HTMLImageElement>('#landingImage, #imgBlkFront, #main-image')?.getAttribute('src') ||
    null;

  const merch = detectMerch({ title, bullets, description, soldByAmazon });
  const productType = detectProductType(title) ?? detectProductType(bullets.join(' '));

  return {
    asin,
    marketplace: mp,
    title,
    brand,
    price: parsePrice(priceText),
    currency: MARKETPLACES[mp].currency,
    rating,
    reviews,
    bsr: ranks[0]?.rank ?? null,
    bsrCategory: ranks[0]?.category ?? null,
    subRanks: ranks.slice(1),
    firstAvailable,
    bullets,
    description: description.slice(0, 2000),
    merch,
    productType,
    image,
    soldByAmazon,
    fetchedAt: Date.now(),
  };
}

/** Amazon's bot check page. */
export function isCaptchaPage(html: string): boolean {
  return /\/errors\/validateCaptcha|captchacharacters|api-services-support@amazon\.com/i.test(html);
}
