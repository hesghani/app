// Realistic sample data so a new user can explore the dashboard before their
// first sync. Deterministic, so screenshots and tests are stable.

import { addDays } from './dates';
import { MARKETPLACES, type MarketplaceId } from './marketplaces';
import { defaultPrice, type ProductType } from './products';
import { DEFAULT_ROYALTY_MODEL, estimateRoyalty } from './royalty';
import type { CatalogItem, SaleRow } from './types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DESIGNS = [
  'Retro Sunset Fishing Dad', 'Plant Mom Era', 'Cat Hair Is My Glitter', 'Pickleball Legend Since',
  'Coffee Then Chaos', 'Vintage Bigfoot Hiking Club', 'Teacher Off Duty Summer', 'Nurse Life Groovy',
  'Gamer Dad Loading', 'Axolotl Kawaii Ramen', 'Book Club Reading Era', 'Gym Rat Raccoon', 'Space Cat Pizza',
  'Dog Grandma Floral', 'Science Pun Atom', 'Crochet Queen Yarn', 'Sourdough Starter Bread Baker',
  'Mushroom Forest Cottagecore', 'Retired Not My Problem', 'Bowling Team Strike', 'Chess King Checkmate',
  'Frog Skateboard Vintage', 'Introverted But Willing', 'Taco Cat Spelled Backwards', 'Christmas Llama Lights',
  'Halloween Ghost Coffee', 'Thanksgiving Turkey Trot', 'Earth Day Every Day', 'Camping Crew Matching',
  'Volleyball Mom Leopard', 'Pharmacy Tech Squad', 'Electrician Funny Ohm', 'Welder Sparks Fly', 'Bee Kind Floral',
];

const TYPES: Array<[ProductType, number]> = [
  ['STANDARD_TSHIRT', 0.58], ['PREMIUM_TSHIRT', 0.08], ['HOODIE', 0.1], ['SWEATSHIRT', 0.06],
  ['LONG_SLEEVE', 0.05], ['VNECK', 0.04], ['TANK', 0.03], ['POPSOCKET', 0.04], ['TOTE', 0.02],
];

const MARKETS: Array<[MarketplaceId, number]> = [['US', 0.7], ['UK', 0.1], ['DE', 0.12], ['FR', 0.03], ['IT', 0.02], ['ES', 0.02], ['JP', 0.01]];

function weighted<T>(random: () => number, items: Array<[T, number]>): T {
  let r = random();
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[0]![0];
}

/** Knuth's method; fine for the small rates used here. */
function poisson(random: () => number, lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= random();
  } while (p > limit);
  return k - 1;
}

function asinFor(i: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = 'B0';
  let n = (i + 7) * 2654435761;
  for (let k = 0; k < 8; k++) {
    s += chars[n % chars.length];
    n = Math.floor(n / chars.length) + 97 * (k + 1);
  }
  return s;
}

export function demoSales(today: string, days = 400): SaleRow[] {
  const random = rng(42);
  const products = DESIGNS.map((design, i) => {
    const type = weighted(random, TYPES);
    return {
      asin: asinFor(i),
      type,
      title: `${design} ${type === 'STANDARD_TSHIRT' ? 'T-Shirt' : type === 'PREMIUM_TSHIRT' ? 'Premium T-Shirt' : type === 'HOODIE' ? 'Pullover Hoodie' : type === 'POPSOCKET' ? 'PopSockets Grip' : type === 'TOTE' ? 'Tote Bag' : type === 'SWEATSHIRT' ? 'Sweatshirt' : type === 'LONG_SLEEVE' ? 'Long Sleeve T-Shirt' : type === 'VNECK' ? 'V-Neck T-Shirt' : 'Tank Top'}`,
      // A few winners and a long tail, like most real accounts.
      strength: 1.6 / (i + 1.4) ** 0.9,
      launch: Math.floor(random() * days * 0.8),
      seasonal: /christmas|halloween|thanksgiving/i.test(design) ? design : null,
    };
  });

  const rows: SaleRow[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = addDays(today, -d);
    const month = Number(date.slice(5, 7));
    const growth = 0.6 + (1 - d / days) * 0.8;
    const q4 = month === 11 ? 1.6 : month === 12 ? 2.1 : 1;
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ? 1.15 : 1;
    for (const p of products) {
      if (days - d < p.launch) continue;
      let lambda = p.strength * growth * q4 * weekend * 1.8;
      if (p.seasonal) {
        const peak = /christmas/i.test(p.seasonal) ? month === 12 : /halloween/i.test(p.seasonal) ? month === 10 : month === 11;
        lambda *= peak ? 6 : 0.08;
      }
      const units = poisson(random, lambda);
      if (!units) continue;
      const mp = weighted(random, MARKETS);
      const price = defaultPrice(p.type, mp);
      const royalty = estimateRoyalty(DEFAULT_ROYALTY_MODEL, p.type, mp, price, random() < 0.25 ? 'plus' : 'creator');
      const cancelled = random() < 0.04 ? 1 : 0;
      const returned = random() < 0.03 ? 1 : 0;
      rows.push({
        date, marketplace: mp, asin: p.asin, productType: p.type, title: p.title,
        units, cancelled, returned: Math.min(returned, units),
        royalty: Math.round(royalty * (units - cancelled) * 100) / 100,
        currency: MARKETPLACES[mp].currency, source: 'demo',
      });
    }
  }
  return rows;
}

const DEAD = [
  'Bigfoot Believer Club', 'Llama Drama Queen', 'Sloth Running Team', 'Gnome Sweet Gnome', 'Taco Bout It', 'Sushi Roll Life',
  'Retro Roller Skate Queen', 'Yeti Hide And Seek Champion', 'Unicorn Squad Leader', 'Avocado Workout Club', 'Narwhal Ocean Dreamer',
  'Bowling Pin Pun', 'Disc Golf Dad', 'Kayak Life Lake Days', 'Beekeeper Honey Boss', 'Frog Prince Vintage', 'Corgi Butt Lover',
  'Pineapple Party Time', 'Moose Lodge Camping', 'Platypus Patrol', 'Cactus Hug Me', 'Bigfoot Fishing Trip', 'Llama Christmas Lights',
  'Sloth Yoga Pose', 'Dinosaur Coffee Monster', 'Alpaca Spit Happens', 'Owl Night Shift', 'Penguin Ice Skater', 'Raccoon Trash Panda Club',
  'Chicken Whisperer Farm', 'Goat Yoga Instructor', 'Koala Nap Time', 'Hedgehog Hugs', 'Squirrel Nut Job', 'Panda Bamboo Snack',
];

/** A sample catalog matching demoSales: every design that sold, plus designs that never did. */
export function demoCatalog(today: string): CatalogItem[] {
  const random = rng(7);
  const sold = new Map<string, CatalogItem>();
  for (const r of demoSales(today, 400)) {
    const key = `${r.marketplace}:${r.asin}`;
    if (sold.has(key)) continue;
    sold.set(key, {
      key, asin: r.asin, id: null, designId: null, title: r.title, brand: 'Sample Studio', productType: r.productType, marketplace: r.marketplace,
      status: 'live', rawStatus: 'LIVE', price: defaultPrice(r.productType ?? 'STANDARD_TSHIRT', r.marketplace), createdAt: addDays(today, -420), image: null, seenAt: 0,
    });
  }
  const dead: CatalogItem[] = DEAD.map((title, i) => {
    const asin = asinFor(1000 + i);
    return {
      key: `US:${asin}`, asin, id: null, designId: null, title: `${title} T-Shirt`, brand: 'Sample Studio', productType: 'STANDARD_TSHIRT', marketplace: 'US',
      status: i % 11 === 10 ? 'rejected' : 'live', rawStatus: i % 11 === 10 ? 'REJECTED' : 'LIVE', price: 19.99,
      createdAt: addDays(today, -(180 + Math.floor(random() * 500))), image: null, seenAt: 0,
    };
  });
  return [...sold.values(), ...dead];
}
