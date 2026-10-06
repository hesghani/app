// Calendar arithmetic in the time zone Merch reports days in, so that a
// timestamp meaning "midnight" stays midnight when moved by whole days,
// across daylight-saving changes. US Pacific by default; Loupe switches to
// the zone Merch's own pages use for "today" when it sees one (some accounts
// get local time).

export const DEFAULT_ZONE = 'America/Los_Angeles';

const formatter = (tz: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

let zone = DEFAULT_ZONE;
let fmt = formatter(zone);

/** Sets the zone days are counted in. Unknown zones are ignored. */
export function setReportZone(tz: string | null | undefined) {
  const next = tz || DEFAULT_ZONE;
  if (next === zone) return;
  try {
    fmt = formatter(next);
    zone = next;
  } catch {
    /* unknown zone */
  }
}

export function reportZone(): string {
  return zone;
}

/** The zone, among `candidates`, in which `ms` is exactly midnight. */
export function zoneOfMidnight(ms: number, candidates: string[]): string | null {
  for (const tz of candidates) {
    try {
      const p: Record<string, number> = {};
      for (const { type, value } of formatter(tz).formatToParts(new Date(ms))) if (type !== 'literal') p[type] = Number(value);
      if (p.hour === 0 && p.minute === 0 && p.second === 0 && ms % 1000 === 0) return tz;
    } catch {
      /* unknown zone */
    }
  }
  return null;
}

function parts(ms: number) {
  const p: Record<string, number> = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) if (type !== 'literal') p[type] = Number(value);
  return { y: p.year!, m: p.month!, d: p.day!, h: p.hour!, mi: p.minute!, s: p.second!, ms: ms - Math.floor(ms / 1000) * 1000 };
}

function offsetAt(ms: number): number {
  const p = parts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s, p.ms) - ms;
}

/** Epoch ms for a Pacific wall-clock time. */
export function zonedToEpoch(y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number {
  const wall = Date.UTC(y, m - 1, d, h, mi, s, ms);
  let guess = wall - offsetAt(wall);
  guess = wall - offsetAt(guess);
  return guess;
}

/** Moves an instant by whole calendar days in Pacific time, keeping its wall-clock time. */
export function shiftZonedDays(ms: number, days: number): number {
  if (!days) return ms;
  const p = parts(ms);
  return zonedToEpoch(p.y, p.m, p.d + days, p.h, p.mi, p.s, p.ms);
}

/** Pacific calendar day of an instant, YYYY-MM-DD. */
export function zonedDay(ms: number): string {
  const p = parts(ms);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}
