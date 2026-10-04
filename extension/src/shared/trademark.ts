// Flags words that commonly get Merch listings rejected: famous brands and
// franchises, legally protected terms, and phrases the Merch content policy
// forbids. This is a fast first pass, not legal advice; the USPTO and TMview
// links let the user check every phrase properly.

import { fold } from './text';

export type HitKind = 'brand' | 'protected' | 'policy' | 'custom';
export type Severity = 'high' | 'medium';

export interface TermHit {
  term: string;
  kind: HitKind;
  severity: Severity;
  reason: string;
  /** Where in the input the term was found, e.g. "title". */
  field?: string;
}

const BRANDS = `
Disney|Pixar|Marvel|Star Wars|Jedi|Sith|Darth Vader|Yoda|Baby Yoda|Grogu|Mandalorian|Lightsaber|Mickey Mouse|Minnie Mouse|
Lilo & Stitch|Lilo and Stitch|Toy Story|Buzz Lightyear|Avengers|Spider-Man|Iron Man|Captain America|Black Panther|Deadpool|
Wolverine|X-Men|Groot|Guardians of the Galaxy|DC Comics|Batman|Superman|Wonder Woman|Justice League|Joker|Harley Quinn|
Harry Potter|Hogwarts|Gryffindor|Slytherin|Hufflepuff|Ravenclaw|Quidditch|Muggle|Pokemon|Pikachu|Nintendo|Super Mario|
Zelda|Animal Crossing|Minecraft|Fortnite|Roblox|Five Nights at Freddy's|Sonic the Hedgehog|Pac-Man|Tetris|PlayStation|
Xbox|Call of Duty|World of Warcraft|Dungeons & Dragons|Dungeons and Dragons|Yu-Gi-Oh|Dragon Ball|Naruto|One Piece|
Studio Ghibli|Totoro|Hello Kitty|Sanrio|Kuromi|Squishmallows|Labubu|Barbie|Hot Wheels|Mattel|Hasbro|Transformers|
My Little Pony|Care Bears|Lego|Snoopy|Charlie Brown|Garfield|Looney Tunes|Bugs Bunny|Scooby-Doo|Sesame Street|Elmo|
Cookie Monster|Muppets|Kermit the Frog|Paw Patrol|Peppa Pig|Bluey|Cocomelon|Baby Shark|SpongeBob|Nickelodeon|Simpsons|
Rick and Morty|Family Guy|South Park|Teenage Mutant Ninja Turtles|Power Rangers|Grinch|Dr. Seuss|Cat in the Hat|
Winnie the Pooh|Star Trek|Lord of the Rings|Hobbit|Game of Thrones|House of the Dragon|Stranger Things|Breaking Bad|
Peaky Blinders|Ted Lasso|Squid Game|Jurassic Park|Ghostbusters|Godzilla|Top Gun|Wednesday Addams|
Coca-Cola|Pepsi|Starbucks|McDonald's|Nike|Just Do It|Adidas|Under Armour|Gucci|Louis Vuitton|Chanel|Versace|Prada|
Harley-Davidson|John Deere|Jeep|Ferrari|Lamborghini|Porsche|Tesla|Crocs|Hydro Flask|Stanley Cup|
Amazon|Google|YouTube|Facebook|Instagram|TikTok|Netflix|Spotify|iPhone|
NFL|NBA|MLB|NHL|NCAA|MLS|WNBA|PGA|NASCAR|WWE|UFC|FIFA|UEFA|Super Bowl|March Madness|World Series|
Elvis Presley|Beatles|Rolling Stones|Grateful Dead|Metallica|AC/DC|Taylor Swift
`;

const PROTECTED: Array<[string, string]> = [
  ['Olympic', 'Protected by law in the US (Ted Stevens Act) and most countries'],
  ['Olympics', 'Protected by law in the US (Ted Stevens Act) and most countries'],
  ['Paralympic', 'Protected by law, like the Olympic marks'],
  ['NASA', 'NASA names and insignia may not be used commercially without approval'],
  ['Red Cross', 'Protected emblem under the Geneva Conventions'],
  ['Smokey Bear', 'Protected by US federal law'],
  ['Girl Scouts', 'Registered marks of a chartered organization'],
  ['Boy Scouts', 'Registered marks of a chartered organization'],
  ['4-H', 'Protected by US federal law'],
  ['FBI', 'Government agency names and seals are restricted'],
  ['Secret Service', 'Government agency names and seals are restricted'],
];

const POLICY: Array<[string, string]> = [
  ['best seller', 'Sales-rank claims are not allowed in listings'],
  ['bestseller', 'Sales-rank claims are not allowed in listings'],
  ['best selling', 'Sales-rank claims are not allowed in listings'],
  ['top rated', 'Review and rating claims are not allowed'],
  ['five star', 'Review and rating claims are not allowed'],
  ['5 star', 'Review and rating claims are not allowed'],
  ['free shipping', 'Shipping, price and promotion claims are not allowed'],
  ['shipping', 'Shipping, price and promotion claims are not allowed'],
  ['on sale', 'Shipping, price and promotion claims are not allowed'],
  ['discount', 'Shipping, price and promotion claims are not allowed'],
  ['lowest price', 'Shipping, price and promotion claims are not allowed'],
  ['cheap', 'Shipping, price and promotion claims are not allowed'],
  ['money back', 'Guarantees are not allowed'],
  ['guaranteed', 'Guarantees are not allowed'],
  ['guarantee', 'Guarantees are not allowed'],
  ['limited time', 'Time-limited promotions are not allowed'],
  ['official', 'Implies a licence you probably do not hold'],
  ['officially licensed', 'Implies a licence you probably do not hold'],
  ['licensed', 'Implies a licence you probably do not hold'],
  ['authentic', 'Implies a licence you probably do not hold'],
  ['charity', 'Charitable claims need proof and are usually rejected'],
  ['donate', 'Charitable claims need proof and are usually rejected'],
  ['donation', 'Charitable claims need proof and are usually rejected'],
  ['proceeds', 'Charitable claims need proof and are usually rejected'],
  ['fundraiser', 'Charitable claims need proof and are usually rejected'],
  ['antibacterial', 'Pesticide claims are prohibited on Amazon'],
  ['antimicrobial', 'Pesticide claims are prohibited on Amazon'],
  ['antiviral', 'Pesticide claims are prohibited on Amazon'],
  ['cure', 'Health claims are not allowed'],
  ['cures', 'Health claims are not allowed'],
  ['fda', 'Health claims are not allowed'],
  ['prime', 'Amazon trademark'],
  ['merch by amazon', 'Amazon trademark'],
  ['merch on demand', 'Amazon trademark'],
  ['etsy', 'Other marketplaces may not be mentioned'],
  ['redbubble', 'Other marketplaces may not be mentioned'],
  ['teepublic', 'Other marketplaces may not be mentioned'],
];

interface Entry { term: string; folded: string; compact: string; kind: HitKind; severity: Severity; reason: string }

function entry(term: string, kind: HitKind, severity: Severity, reason: string): Entry {
  const folded = fold(term);
  return { term, folded, compact: folded.replace(/ /g, ''), kind, severity, reason };
}

const BUILT_IN: Entry[] = [
  ...BRANDS.split('|').map((t) => t.trim()).filter(Boolean)
    .map((t) => entry(t, 'brand', 'high', 'Famous trademark or franchise')),
  ...PROTECTED.map(([t, reason]) => entry(t, 'protected', 'high', reason)),
  ...POLICY.map(([t, reason]) => entry(t, 'policy', 'medium', reason)),
];

export const BUILT_IN_TERM_COUNT = BUILT_IN.length;

export interface ScanOptions {
  custom?: string[];
  ignore?: string[];
}

/** Scans named fields (title, bullets…) and returns every risky term found, most severe first. */
export function scanText(fields: Record<string, string>, options: ScanOptions = {}): TermHit[] {
  const ignore = new Set((options.ignore ?? []).map(fold));
  const entries = [
    ...BUILT_IN,
    ...(options.custom ?? []).map((t) => t.trim()).filter(Boolean)
      .map((t) => entry(t, 'custom', 'high', 'On your watch list')),
  ].filter((e) => e.folded && !ignore.has(e.folded));

  const hits: TermHit[] = [];
  const seen = new Set<string>();
  for (const [field, value] of Object.entries(fields)) {
    const folded = ` ${fold(value)} `;
    if (folded.trim() === '') continue;
    for (const e of entries) {
      const key = `${e.folded}|${field}`;
      if (seen.has(key)) continue;
      const found =
        folded.includes(` ${e.folded} `) || (e.compact.length > 4 && e.compact !== e.folded && folded.includes(` ${e.compact} `));
      if (found) {
        seen.add(key);
        hits.push({ term: e.term, kind: e.kind, severity: e.severity, reason: e.reason, field });
      }
    }
    if (/https?:\/\/|www\.|\b[\w.+-]+@[\w-]+\.\w{2,}\b/i.test(value) && !seen.has(`url|${field}`)) {
      seen.add(`url|${field}`);
      hits.push({ term: 'URL or email', kind: 'policy', severity: 'medium', reason: 'Contact details and links are not allowed', field });
    }
  }
  // When "officially licensed" matches, drop the overlapping "official"/"licensed" hits.
  const filtered = hits.filter(
    (h) =>
      !hits.some(
        (o) => o !== h && o.field === h.field && fold(o.term).length > fold(h.term).length && ` ${fold(o.term)} `.includes(` ${fold(h.term)} `),
      ),
  );
  return filtered.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
}

/** Short phrases worth looking up in a trademark register: the brand, and each part of the title. */
export function phrasesToCheck(brand: string, title: string, max = 6): string[] {
  const parts = [brand, ...title.split(/\s[-–—|:]\s|[,;!?]/)]
    .map((p) => p.replace(/\b(?:t-?shirt|tee|shirt|hoodie|sweatshirt|tank top|gift|funny|men|women|kids)\b/gi, ' '))
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 3 && p.split(' ').length <= 6);
  return Array.from(new Set(parts.map((p) => p.toLowerCase()))).slice(0, max);
}

export function usptoUrl(phrase: string): string {
  return `https://tmsearch.uspto.gov/search/search-results?query=${encodeURIComponent(phrase)}&section=default`;
}

export function tmviewUrl(phrase: string): string {
  return `https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=${encodeURIComponent(phrase)}`;
}
