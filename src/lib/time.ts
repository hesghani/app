// Calendar and clock helpers that work in the user's chosen time zone,
// which can differ from the device's (e.g. a city picked from the list).

import type { Ymd } from './praytimes';

const cache = new Map<string, Intl.DateTimeFormat>();
const formatter = (key: string, make: () => Intl.DateTimeFormat) => {
  let f = cache.get(key);
  if (!f) cache.set(key, (f = make()));
  return f;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function prefers12h() {
  try {
    const hc = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return hc === 'h12' || hc === 'h11';
  } catch {
    return true;
  }
}

export function zonedParts(ms: number, tz: string) {
  const f = formatter(`parts|${tz}`, () =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }),
  );
  const o: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(new Date(ms))) o[type] = value;
  return {
    y: +o.year,
    m: +o.month,
    d: +o.day,
    h: +o.hour % 24,
    min: +o.minute,
    s: +o.second,
    wd: WEEKDAYS.indexOf(o.weekday),
  };
}

export const ymdOf = (ms: number, tz: string): Ymd => {
  const { y, m, d } = zonedParts(ms, tz);
  return { y, m, d };
};

export function addDays({ y, m, d }: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymdKey = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;
export const keyYmd = (k: string): Ymd => {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m, d };
};
export const addDaysKey = (k: string, n: number) => ymdKey(addDays(keyYmd(k), n));
export const weekdayOf = ({ y, m, d }: Ymd) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
export const dayNumber = ({ y, m, d }: Ymd) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
export const daysBetween = (fromKey: string, toKey: string) => dayNumber(keyYmd(toKey)) - dayNumber(keyYmd(fromKey));
export const todayKey = (tz: string, now = Date.now()) => ymdKey(ymdOf(now, tz));

/** Minutes since local midnight in the given zone. */
export function minutesOfDay(ms: number, tz: string) {
  const p = zonedParts(ms, tz);
  return p.h * 60 + p.min;
}

export const hmToMinutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const minutesToHm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

/** UTC instant for a local wall-clock time on a calendar date in a zone. */
export function zonedInstant(key: string, hm: string, tz: string) {
  const { y, m, d } = keyYmd(key);
  const [h, min] = hm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = zonedParts(guess, tz);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess;
  return guess - offset;
}

export function clockParts(ms: number | null, tz: string, h12: boolean) {
  if (ms == null) return { time: '--:--', period: '' };
  const f = formatter(`clock|${tz}|${h12}`, () =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: h12 ? 'numeric' : '2-digit',
      minute: '2-digit',
      ...(h12 ? { hour12: true } : { hourCycle: 'h23' as const }),
    }),
  );
  let time = '';
  let period = '';
  for (const { type, value } of f.formatToParts(new Date(ms))) {
    if (type === 'dayPeriod') period = value.toUpperCase();
    else if (type === 'hour' || type === 'minute' || type === 'literal') time += value;
  }
  return { time: time.trim(), period };
}

export function formatClock(ms: number | null, tz: string, h12: boolean) {
  const { time, period } = clockParts(ms, tz, h12);
  return period ? `${time} ${period}` : time;
}

/** "14:30" -> "2:30 PM" or "14:30". */
export function formatHm(hm: string, h12: boolean) {
  const [h, m] = hm.split(':').map(Number);
  if (!h12) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDate(ms: number, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const f = formatter(`date|${tz}|${JSON.stringify(opts)}`, () => new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }));
  return f.format(new Date(ms));
}

export function formatKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const { y, m, d } = keyYmd(key);
  return formatDate(Date.UTC(y, m - 1, d, 12), 'UTC', opts);
}

/** "2h 05m" above an hour, "12:04" below it. Never shows 0:00 before the moment arrives. */
export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}:${pad(s % 60)}`;
}

/** Short relative form for lists: "in 2h", "in 35m". */
export function relativeIn(ms: number) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `in ${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

export function minutesLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Monday that starts the week containing this date. */
export function weekStartKey(key: string) {
  const ymd = keyYmd(key);
  const wd = (weekdayOf(ymd) + 6) % 7;
  return ymdKey(addDays(ymd, -wd));
}

export const weekKeys = (key: string) => {
  const start = weekStartKey(key);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
};
