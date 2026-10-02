import type { Ymd } from './praytimes';

// Hijri dates. Uses the Umm al-Qura calendar built into modern browsers and
// falls back to the tabular Islamic calendar when it is missing.

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabiʿ al-Awwal',
  'Rabiʿ al-Thani',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  'Shaʿban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qaʿdah',
  'Dhu al-Hijjah',
];

let intl: Intl.DateTimeFormat | null | undefined;
function umalqura() {
  if (intl !== undefined) return intl;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    intl = f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null;
  } catch {
    intl = null;
  }
  return intl;
}

export interface Hijri {
  y: number;
  m: number;
  d: number;
}

export function tabularHijri(ms: number): Hijri {
  const jd = Math.floor(ms / 86400000 + 2440587.5);
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709);
  const d = l - Math.floor((709 * m) / 24);
  return { y: 30 * n + j - 30, m, d };
}

// Hijri date for the daytime of a Gregorian calendar date, with a manual moon-sighting offset.
export function hijriFromYmd({ y, m, d }: Ymd, offset = 0): Hijri {
  const ms = Date.UTC(y, m - 1, d + offset, 12);
  const f = umalqura();
  if (f) {
    const o: Record<string, string> = {};
    for (const { type, value } of f.formatToParts(new Date(ms))) o[type] = value;
    const year = parseInt(o.year ?? o.relatedYear, 10);
    if (year && +o.month && +o.day) return { y: year, m: +o.month, d: +o.day };
  }
  return tabularHijri(ms);
}

export const hijriLabel = (h: Hijri) => `${h.d} ${HIJRI_MONTHS[h.m - 1]} ${h.y}`;
