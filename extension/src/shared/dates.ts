// Date parsing for the "Date First Available" line in every Merch marketplace
// language, plus small helpers for local calendar dates (YYYY-MM-DD).

import { fold } from './text';

const MONTHS: Record<string, number> = {};
const NAMES: Array<[number, string[]]> = [
  [1, ['january', 'jan', 'januar', 'janner', 'janvier', 'janv', 'gennaio', 'gen', 'enero', 'ene']],
  [2, ['february', 'feb', 'februar', 'fevrier', 'fevr', 'fev', 'febbraio', 'febrero']],
  [3, ['march', 'mar', 'marz', 'mars', 'marzo']],
  [4, ['april', 'apr', 'avril', 'avr', 'aprile', 'abril', 'abr']],
  [5, ['may', 'mai', 'maggio', 'mag', 'mayo']],
  [6, ['june', 'jun', 'juni', 'juin', 'giugno', 'giu', 'junio']],
  [7, ['july', 'jul', 'juli', 'juillet', 'juil', 'luglio', 'lug', 'julio']],
  [8, ['august', 'aug', 'aout', 'agosto', 'ago']],
  [9, ['september', 'sep', 'sept', 'septembre', 'settembre', 'set', 'septiembre', 'setiembre']],
  [10, ['october', 'oct', 'oktober', 'okt', 'octobre', 'ottobre', 'ott', 'octubre']],
  [11, ['november', 'nov', 'novembre', 'noviembre']],
  [12, ['december', 'dec', 'dezember', 'dez', 'decembre', 'dicembre', 'dic', 'diciembre']],
];
for (const [month, names] of NAMES) for (const name of names) MONTHS[name] = month;

function iso(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "March 3, 2023", "3 Mar. 2023", "3. März 2023", "3 mars 2023", "2023/3/3", "2023年3月3日" → "2023-03-03". */
export function parseLooseDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const numeric = text.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (numeric) return iso(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));

  const tokens = fold(text).split(' ');
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  for (const token of tokens) {
    if (/^\d{4}$/.test(token) && year === null) year = Number(token);
    else if (/^\d{1,2}$/.test(token) && day === null) day = Number(token);
    else if (month === null && MONTHS[token] !== undefined) month = MONTHS[token]!;
  }
  if (year === null || month === null) return null;
  return iso(year, month, day ?? 1);
}

/** Local calendar date for a timestamp, as YYYY-MM-DD. */
export function localDay(time: number | Date = Date.now()): string {
  const d = time instanceof Date ? time : new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Calendar date in Amazon's reporting time zone (US Pacific). */
export function pacificDay(time: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(time));
  return parts;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function ageInDays(isoDay: string | null, now = Date.now()): number | null {
  if (!isoDay) return null;
  return daysBetween(isoDay, localDay(now));
}

export type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'month' | 'lastMonth' | 'year' | 'all';

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  month: 'This month',
  lastMonth: 'Last month',
  year: 'This year',
  all: 'All time',
};

export interface DayRange { from: string; to: string }

export function resolveRange(key: RangeKey, today = localDay(), earliest = '2015-01-01'): DayRange {
  const [y, m] = today.split('-').map(Number) as [number, number];
  switch (key) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const d = addDays(today, -1); return { from: d, to: d }; }
    case '7d': return { from: addDays(today, -6), to: today };
    case '30d': return { from: addDays(today, -29), to: today };
    case '90d': return { from: addDays(today, -89), to: today };
    case 'month': return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'lastMonth': {
      const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      const last = addDays(`${today.slice(0, 7)}-01`, -1);
      return { from: first, to: last };
    }
    case 'year': return { from: `${y}-01-01`, to: today };
    case 'all': return { from: earliest, to: today };
  }
}

/** The range of equal length immediately before `range`, for period-over-period deltas. */
export function previousRange(range: DayRange): DayRange {
  const length = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}
