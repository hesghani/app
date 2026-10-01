// Calendar and clock helpers that work in the prayer location's time zone,
// which can differ from the device's.

const cache = new Map();
const formatter = (key, make) => {
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

export function zonedParts(ms, tz) {
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
  const o = {};
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

export const ymdOf = (ms, tz) => {
  const { y, m, d } = zonedParts(ms, tz);
  return { y, m, d };
};

export function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const pad = (n) => String(n).padStart(2, '0');
export const ymdKey = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
export const keyYmd = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m, d };
};
export const weekdayOf = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
export const dayNumber = ({ y, m, d }) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

export function clockParts(ms, tz, h12) {
  if (ms == null) return { time: '--:--', period: '' };
  const f = formatter(`clock|${tz}|${h12}`, () =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: h12 ? 'numeric' : '2-digit',
      minute: '2-digit',
      ...(h12 ? { hour12: true } : { hourCycle: 'h23' }),
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

export function formatClock(ms, tz, h12) {
  const { time, period } = clockParts(ms, tz, h12);
  return period ? `${time} ${period}` : time;
}

export function formatDate(ms, tz, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const f = formatter(`date|${tz}|${JSON.stringify(opts)}`, () => new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }));
  return f.format(new Date(ms));
}

// "2h 05m" above an hour, "12:04" below it. Never shows 0:00 before the moment arrives.
export function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}:${pad(s % 60)}`;
}

export function minutesLabel(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
