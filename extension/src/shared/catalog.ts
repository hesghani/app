// Turns the Merch "Manage" product list, in whatever shape it arrives, into
// CatalogItems. Like the sales normalizer, it walks the JSON and resolves
// fields from lists of plausible names; listings nested under a product
// (one per marketplace) inherit the product's title, brand and design id.

import { toDay } from './sales';
import { MARKETPLACES, marketplaceFromAny, type MarketplaceId } from './marketplaces';
import { productTypeFromLabel } from './products';
import type { CatalogItem, CatalogStatus } from './types';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const KEYS = {
  asin: ['asin', 'childasin', 'productasin', 'listingasin'],
  id: ['id', 'productid', 'listingid', 'merchproductid', 'gearproductid', 'uuid', 'externalid'],
  listingId: ['listingid', 'merchlistingid'],
  designId: ['designid', 'artworkid', 'imageid', 'designuuid', 'groupid', 'parentid'],
  title: ['title', 'producttitle', 'designtitle', 'listingtitle', 'itemname', 'name', 'productname', 'designname'],
  brand: ['brand', 'brandname'],
  productType: ['producttype', 'garmenttype', 'shirttype', 'productcategory', 'producttypename', 'type'],
  marketplace: ['marketplace', 'marketplaceid', 'marketplacename', 'marketplacecode', 'market', 'countrycode', 'country', 'site', 'domain', 'storefront', 'saleschannel'],
  status: ['status', 'productstatus', 'listingstatus', 'state', 'publishstatus', 'publishingstatus', 'lifecyclestatus'],
  price: ['price', 'listprice', 'listingprice', 'retailprice'],
  createdAt: ['createddate', 'creationdate', 'createdat', 'created', 'datecreated', 'publisheddate', 'publishdate', 'firstpublisheddate', 'livedate', 'submitteddate', 'uploaddate', 'createdon', 'createtime', 'creationtime'],
  image: ['imageurl', 'image', 'thumbnail', 'thumbnailurl', 'previewurl', 'mockupurl', 'imagepreviewurl'],
  sales: ['units', 'unitssold', 'royalty', 'royalties', 'purchased'],
} as const;

type Field = keyof typeof KEYS;

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(obj: Obj, field: Field): Json | undefined {
  for (const alias of KEYS[field]) {
    for (const [k, v] of Object.entries(obj)) {
      if (norm(k) === alias && v !== null && v !== '' && typeof v !== 'object') return v;
    }
  }
  // Money-like objects: {amount, currencyCode}
  if (field === 'price') {
    for (const alias of KEYS.price) {
      for (const [k, v] of Object.entries(obj)) {
        if (norm(k) === alias && v && typeof v === 'object' && !Array.isArray(v)) {
          const amount = (v as Obj).amount ?? (v as Obj).value;
          if (typeof amount === 'number' || typeof amount === 'string') return amount;
        }
      }
    }
  }
  return undefined;
}

const str = (v: Json | undefined) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export function normalizeStatus(raw: string): CatalogStatus {
  const s = raw.toLowerCase();
  if (!s) return 'other';
  if (/reject|declin|denied|violat|not.?approved/.test(s)) return 'rejected';
  if (/remov|delet|archiv|timed.?out|inactive|unpublish|delist|expired|not.?discoverable/.test(s)) return 'removed';
  if (/review|pending|submitted|under/.test(s)) return 'review';
  if (/process|transcod|in.?progress|publishing|propagat|translat/.test(s)) return 'processing';
  if (/draft|unsubmitted|not.?submitted/.test(s)) return 'draft';
  if (/live|published|active|available|approved|on.?sale/.test(s)) return 'live';
  return 'other';
}

interface Ctx {
  title?: string;
  brand?: string;
  designId?: string;
  productType?: string;
  createdAt?: string;
  status?: string;
  image?: string;
  id?: string;
  listingId?: string;
  marketplace?: MarketplaceId;
}

function own(obj: Obj): Ctx {
  const ctx: Ctx = {};
  const title = str(pick(obj, 'title'));
  if (title) ctx.title = title;
  const brand = str(pick(obj, 'brand'));
  if (brand) ctx.brand = brand;
  const designId = str(pick(obj, 'designId'));
  if (designId) ctx.designId = designId;
  const type = str(pick(obj, 'productType'));
  if (type) ctx.productType = type;
  const created = toDay(pick(obj, 'createdAt'));
  if (created) ctx.createdAt = created;
  const status = str(pick(obj, 'status'));
  if (status) ctx.status = status;
  const image = str(pick(obj, 'image'));
  if (image) ctx.image = image;
  const id = str(pick(obj, 'id'));
  if (id) ctx.id = id;
  const listingId = str(pick(obj, 'listingId'));
  if (listingId) ctx.listingId = listingId;
  const mp = marketplaceFromAny(pick(obj, 'marketplace'));
  if (mp) ctx.marketplace = mp;
  return ctx;
}

function isListingLike(x: Json): boolean {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Obj;
  if (pick(o, 'asin') !== undefined || pick(o, 'marketplace') !== undefined) return true;
  return pick(o, 'title') !== undefined && (pick(o, 'status') !== undefined || pick(o, 'productType') !== undefined || pick(o, 'id') !== undefined);
}

function hasChildListings(obj: Obj): boolean {
  return Object.values(obj).some((v) => Array.isArray(v) && v.some(isListingLike));
}

export function normalizeCatalog(payload: unknown, now = Date.now()): CatalogItem[] {
  const items = new Map<string, CatalogItem>();
  const seen = new WeakSet<object>();

  const emit = (c: Ctx, asin: string | null, priceRaw: Json | undefined) => {
    if (!c.title && !asin) return;
    const productType = productTypeFromLabel(c.productType ?? null) ?? productTypeFromLabel(c.title ?? null);
    // A Merch listing id stays the same while the listing gets its ASIN and changes status.
    const key = c.listingId && c.marketplace ? `L:${c.listingId}` : asin ? `${c.marketplace ?? 'XX'}:${asin}` : `id:${c.id ?? ''}:${c.marketplace ?? ''}:${c.productType ?? ''}:${c.title ?? ''}`;
    const price = typeof priceRaw === 'number' ? priceRaw : priceRaw !== undefined ? Number(String(priceRaw).replace(/[^\d.]/g, '')) || null : null;
    items.set(key, {
      key,
      asin,
      id: c.id ?? null,
      designId: c.designId ?? null,
      title: (c.title ?? '').slice(0, 200),
      brand: (c.brand ?? '').slice(0, 100),
      productType,
      marketplace: c.marketplace ?? null,
      status: normalizeStatus(c.status ?? ''),
      rawStatus: (c.status ?? '').slice(0, 40),
      price,
      createdAt: c.createdAt ?? null,
      image: c.image ?? null,
      seenAt: now,
    });
  };

  const walk = (node: Json, ctx: Ctx, depth: number) => {
    if (depth > 10 || node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, ctx, depth + 1);
      return;
    }
    // Sales rows belong to the sales normalizer.
    if (pick(node, 'sales') !== undefined && pick(node, 'asin') !== undefined) return;
    const merged: Ctx = { ...ctx, ...own(node) };
    const asinRaw = str(pick(node, 'asin')).toUpperCase();
    const asin = /^[A-Z0-9]{10}$/.test(asinRaw) ? asinRaw : null;
    const looksLikeProduct = asin !== null || (merged.title && (pick(node, 'status') !== undefined || pick(node, 'productType') !== undefined || pick(node, 'id') !== undefined));
    if (looksLikeProduct && !hasChildListings(node)) {
      emit(merged, asin, pick(node, 'price'));
      return;
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value, merged, depth + 1);
    }
  };

  walk(payload as Json, {}, 0);
  const list = Array.from(items.values());
  // A lone object with a title isn't a catalog; require some product signal overall.
  const productish = list.filter((i) => i.asin || i.status !== 'other' || i.productType);
  return productish.length ? list : [];
}

export function catalogMarketplace(item: CatalogItem): MarketplaceId {
  return item.marketplace ?? 'US';
}

export function catalogCurrency(item: CatalogItem) {
  return MARKETPLACES[catalogMarketplace(item)].currency;
}
