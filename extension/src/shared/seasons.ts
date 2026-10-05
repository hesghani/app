// Selling seasons for print-on-demand apparel, with the keywords that tie a
// design to each one. Dates are US retail dates.

import { addDays } from './dates';

export interface Season {
  id: string;
  name: string;
  /** Matches a design title (folded, lowercase). */
  keywords: RegExp;
  /** The event day in a given year, YYYY-MM-DD. */
  date: (year: number) => string;
  /** Shoppers start buying this many days before the event. */
  leadDays: number;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The n-th given weekday (0 = Sunday) of a month. */
function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return iso(y, m, day);
}

/** Western Easter (anonymous Gregorian algorithm). */
function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}

export const SEASONS: Season[] = [
  { id: 'valentine', name: "Valentine's Day", keywords: /\b(?:valentines?|galentines?|cupid|be mine)\b/, date: (y) => iso(y, 2, 14), leadDays: 35 },
  { id: 'stpatrick', name: "St. Patrick's Day", keywords: /\b(?:st patricks?|patricks? day|shamrocks?|irish|leprechauns?|clover)\b/, date: (y) => iso(y, 3, 17), leadDays: 35 },
  { id: 'easter', name: 'Easter', keywords: /\b(?:easter|bunny|bunnies|egg hunt)\b/, date: easter, leadDays: 35 },
  { id: 'teacher', name: 'Teacher Appreciation Week', keywords: /\b(?:teachers?|teaching|educators?|classroom)\b/, date: (y) => nthWeekday(y, 5, 1, 1), leadDays: 30 },
  { id: 'nurse', name: 'Nurses Week', keywords: /\b(?:nurses?|nursing|rn|cna|lpn|icu)\b/, date: (y) => iso(y, 5, 6), leadDays: 30 },
  { id: 'mother', name: "Mother's Day", keywords: /\b(?:mothers?|moms?|mama|mommy|grandma|nana|mimi|gigi)\b/, date: (y) => nthWeekday(y, 5, 0, 2), leadDays: 35 },
  { id: 'graduation', name: 'Graduation', keywords: /\b(?:graduat\w*|class of|senior 20\d\d|grad)\b/, date: (y) => iso(y, 6, 1), leadDays: 45 },
  { id: 'father', name: "Father's Day", keywords: /\b(?:fathers?|dads?|daddy|papa|grandpa|pops)\b/, date: (y) => nthWeekday(y, 6, 0, 3), leadDays: 35 },
  { id: 'july4', name: '4th of July', keywords: /\b(?:4th of july|fourth of july|independence day|america|usa|patriot\w*|merica|freedom)\b/, date: (y) => iso(y, 7, 4), leadDays: 35 },
  { id: 'school', name: 'Back to School', keywords: /\b(?:back to school|first day of school|school|kindergarten|\d+(?:st|nd|rd|th) grade)\b/, date: (y) => iso(y, 8, 20), leadDays: 30 },
  { id: 'halloween', name: 'Halloween', keywords: /\b(?:halloween|spooky|witch\w*|pumpkins?|ghosts?|skeletons?|zombies?|vampires?|boo|trick or treat|costume)\b/, date: (y) => iso(y, 10, 31), leadDays: 45 },
  { id: 'thanksgiving', name: 'Thanksgiving', keywords: /\b(?:thanksgiving|turkey|thankful|grateful|gobble|pilgrims?)\b/, date: (y) => nthWeekday(y, 11, 4, 4), leadDays: 30 },
  { id: 'christmas', name: 'Christmas', keywords: /\b(?:christmas|xmas|santa|elf|elves|reindeer|grinch|ugly sweater|holiday|naughty|jingle|snowman|merry)\b/, date: (y) => iso(y, 12, 25), leadDays: 55 },
  { id: 'newyear', name: "New Year's", keywords: /\b(?:new year|nye|20\d\d goals)\b/, date: (y) => iso(y, 12, 31), leadDays: 21 },
];

export interface UpcomingSeason {
  season: Season;
  date: string;
  /** First day shoppers buy, and the day new designs should be live by. */
  sellingFrom: string;
  uploadBy: string;
  daysUntil: number;
}

/** Seasons whose selling window starts within `horizon` days (or is already open). */
export function upcomingSeasons(today: string, horizon = 90): UpcomingSeason[] {
  const year = Number(today.slice(0, 4));
  const out: UpcomingSeason[] = [];
  for (const season of SEASONS) {
    for (const y of [year, year + 1]) {
      const date = season.date(y);
      if (date < today) continue;
      const sellingFrom = addDays(date, -season.leadDays);
      const daysUntil = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
      if (daysUntil - season.leadDays <= horizon) {
        // Designs need ~2 weeks to get indexed and pick up sales before the rush.
        out.push({ season, date, sellingFrom, uploadBy: addDays(sellingFrom, -14), daysUntil });
      }
      break;
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
