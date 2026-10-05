// Calendar arithmetic in Amazon's reporting time zone (US Pacific), so that a
// timestamp meaning "midnight Pacific" stays midnight Pacific when moved by
// whole days, across daylight-saving changes.

const TZ = 'America/Los_Angeles';
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

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
