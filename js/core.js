// Turns stored settings plus "now" into everything the screens need to know about the day.

import { prayerTimes, PRAYERS, methodForTimeZone, asrForTimeZone, sunAltitude } from './lib/praytimes.js';
import { addDays, ymdKey, ymdOf, weekdayOf, dayNumber, formatClock, prefers12h } from './lib/time.js';
import { hijriFromYmd, hijriLabel } from './lib/hijri.js';
import { pickNudge } from './lib/nudges.js';
import { wisdomFor } from './data/wisdom.js';

export const NAMES = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

const timesCache = new Map();

export function resolveSettings(settings) {
  const tz = settings.loc?.tz ?? 'UTC';
  return {
    method: settings.method === 'auto' ? methodForTimeZone(tz) : settings.method,
    asr: settings.asr === 'auto' ? asrForTimeZone(tz) : settings.asr,
    h12: settings.clock === 'auto' ? prefers12h() : settings.clock === '12',
  };
}

export function timesFor(ymd, settings) {
  const { loc, hijriOffset } = settings;
  const { method, asr } = resolveSettings(settings);
  // Umm al-Qura extends Isha to two hours after Maghrib during Ramadan.
  const isha = method === 'Makkah' && hijriFromYmd(ymd, hijriOffset).m === 9 ? '120 min' : undefined;
  const key = `${ymdKey(ymd)}|${loc.lat}|${loc.lng}|${method}|${asr}|${isha}`;
  let t = timesCache.get(key);
  if (!t) {
    if (timesCache.size > 64) timesCache.clear();
    t = prayerTimes(ymd, loc.lat, loc.lng, { method, asr, isha });
    timesCache.set(key, t);
  }
  return t;
}

const PERIOD_STARTS = [
  ['isha', 'night'],
  ['maghrib', 'dusk'],
  ['asr', 'afternoon'],
  ['dhuhr', 'noon'],
  ['sunrise', 'morning'],
  ['fajr', 'dawn'],
];

export function computeDay(settings, now = Date.now()) {
  const { loc } = settings;
  const tz = loc.tz;
  const { h12 } = resolveSettings(settings);
  const clock = (ms) => formatClock(ms, tz, h12);

  const today = ymdOf(now, tz);
  const tToday = timesFor(today, settings);
  // A prayer day runs from Fajr to Fajr. Before Fajr you are still finishing yesterday.
  const beforeFajr = tToday.fajr != null && now < tToday.fajr;
  const dayYmd = beforeFajr ? addDays(today, -1) : today;
  const day = beforeFajr ? timesFor(dayYmd, settings) : tToday;
  const next = beforeFajr ? tToday : timesFor(addDays(today, 1), settings);

  let nextPrayer = null;
  for (const id of PRAYERS) {
    if (day[id] != null && day[id] > now) {
      nextPrayer = { id, at: day[id], tomorrow: false };
      break;
    }
  }
  if (!nextPrayer) nextPrayer = { id: 'fajr', at: next.fajr, tomorrow: !beforeFajr };

  const windowEnd = { fajr: day.sunrise, dhuhr: day.asr, asr: day.maghrib, maghrib: day.isha, isha: next.fajr };
  const currentId = PRAYERS.find((id) => day[id] != null && now >= day[id] && now < (windowEnd[id] ?? Infinity)) ?? null;

  let period = 'night';
  for (const [id, p] of PERIOD_STARTS) {
    if (day[id] != null && now >= day[id]) {
      period = p;
      break;
    }
  }

  const nightStart = day.sunset;
  const nightEnd = next.fajr;
  const night = {
    start: nightStart,
    end: nightEnd,
    lastThird: nightStart != null && nightEnd != null ? nightStart + ((nightEnd - nightStart) * 2) / 3 : null,
  };

  const afterMaghrib = tToday.maghrib != null && now >= tToday.maghrib;
  const hijriToday = hijriFromYmd(today, settings.hijriOffset);
  const hijriTomorrow = hijriFromYmd(addDays(today, 1), settings.hijriOffset);
  const islamicDay = afterMaghrib ? hijriTomorrow : hijriToday;

  let ramadan = null;
  if (hijriToday.m === 9 && now >= tToday.fajr && now < tToday.maghrib) ramadan = { mode: 'iftar', at: tToday.maghrib };
  else if (islamicDay.m === 9 && (afterMaghrib || beforeFajr)) ramadan = { mode: 'suhoor', at: beforeFajr ? tToday.fajr : next.fajr };

  const weekday = weekdayOf(today);
  const nudge = pickNudge({
    hijriToday,
    hijriTomorrow,
    weekday,
    period,
    afterMaghrib,
    beforeFajr,
    lastThird: night.lastThird,
    now,
    clock,
  });

  return {
    now,
    tz,
    h12,
    clock,
    today,
    key: ymdKey(dayYmd),
    day,
    next,
    nextPrayer,
    currentId,
    period,
    night,
    beforeFajr,
    afterMaghrib,
    weekday,
    islamicDay,
    hijriText: hijriLabel(islamicDay),
    ramadan,
    fajrEnds: currentId === 'fajr' ? day.sunrise : null,
    nudge,
    wisdom: wisdomFor(dayNumber(dayYmd)),
    sunAlt: sunAltitude(now, loc.lat, loc.lng),
  };
}

// Used before a location is set: a rough sky from the device clock.
export function guessPeriod(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 4.5 || h >= 20.5) return 'night';
  if (h < 6.5) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 15.5) return 'noon';
  if (h < 18.5) return 'afternoon';
  return 'dusk';
}
