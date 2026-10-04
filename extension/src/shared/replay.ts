// Replaying a captured Merch request later means its date range has to move
// with the calendar: a "last 7 days" request captured on Monday should ask
// for the 7 days ending today when replayed on Thursday.

import { addDays, daysBetween, localDay } from './dates';

/** Shifts every date-like query parameter by the number of days since capture. */
export function shiftDateParams(url: string, capturedAt: number, now = Date.now()): string {
  const shift = daysBetween(localDay(capturedAt), localDay(now));
  if (!shift) return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  for (const [key, value] of Array.from(u.searchParams.entries())) {
    let next: string | null = null;
    const iso = value.match(/^(\d{4}-\d{2}-\d{2})(.*)$/);
    if (iso) next = `${addDays(iso[1]!, shift)}${iso[2]}`;
    else if (/^\d{13}$/.test(value)) next = String(Number(value) + shift * 86_400_000);
    else if (/^\d{10}$/.test(value) && Number(value) > 1_400_000_000) next = String(Number(value) + shift * 86_400);
    if (next !== null) u.searchParams.set(key, next);
  }
  return u.href;
}
