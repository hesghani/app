// Everything the screens need to know about "now": prayer times, the next prayer, Hijri date.

import { hijriFromYmd, hijriLabel } from './hijri';
import type { Settings } from './model';
import {
  PRAYERS,
  asrForTimeZone,
  methodForTimeZone,
  prayerTimes,
  type AsrMethod,
  type MethodId,
  type PrayerId,
  type PrayerTimes,
  type Ymd,
} from './praytimes';
import { addDays, deviceTimeZone, prefers12h, ymdKey, ymdOf } from './time';

export function resolvePrayerSettings(s: Settings): { method: MethodId; asr: AsrMethod; h12: boolean; tz: string } {
  const tz = s.loc?.tz ?? deviceTimeZone();
  return {
    tz,
    method: s.method === 'auto' ? methodForTimeZone(tz) : s.method,
    asr: s.asr === 'auto' ? asrForTimeZone(tz) : s.asr,
    h12: s.clock === 'auto' ? prefers12h() : s.clock === '12',
  };
}

const cache = new Map<string, PrayerTimes>();

export function timesFor(ymd: Ymd, s: Settings): PrayerTimes | null {
  if (!s.loc) return null;
  const { method, asr } = resolvePrayerSettings(s);
  // Umm al-Qura extends Isha to two hours after Maghrib during Ramadan.
  const isha = method === 'Makkah' && hijriFromYmd(ymd, s.hijriOffset).m === 9 ? '120 min' : undefined;
  const key = `${ymdKey(ymd)}|${s.loc.lat}|${s.loc.lng}|${method}|${asr}|${isha}`;
  let t = cache.get(key);
  if (!t) {
    if (cache.size > 64) cache.clear();
    t = prayerTimes(ymd, s.loc.lat, s.loc.lng, { method, asr, isha });
    cache.set(key, t);
  }
  return t;
}

export interface DayContext {
  now: number;
  tz: string;
  h12: boolean;
  today: string;
  ymd: Ymd;
  times: PrayerTimes | null;
  next: { id: PrayerId; at: number; tomorrow: boolean } | null;
  /** The prayer whose time has started and not yet ended. */
  current: PrayerId | null;
  hijri: string;
  ramadan: boolean;
  /** Greeting period from the local clock. */
  part: 'morning' | 'afternoon' | 'evening' | 'night';
}

export function dayContext(s: Settings, now = Date.now()): DayContext {
  const { tz, h12 } = resolvePrayerSettings(s);
  const ymd = ymdOf(now, tz);
  const times = timesFor(ymd, s);
  let next: DayContext['next'] = null;
  let current: PrayerId | null = null;
  if (times) {
    for (const id of PRAYERS) {
      const at = times[id];
      if (at != null && at > now) {
        next = { id, at, tomorrow: false };
        break;
      }
    }
    if (!next) {
      const t2 = timesFor(addDays(ymd, 1), s);
      if (t2?.fajr != null) next = { id: 'fajr', at: t2.fajr, tomorrow: true };
    }
    const ends: Record<PrayerId, number | null> = {
      fajr: times.sunrise,
      dhuhr: times.asr,
      asr: times.maghrib,
      maghrib: times.isha,
      isha: next?.tomorrow ? next.at : null,
    };
    current = PRAYERS.find((id) => times[id] != null && now >= times[id]! && now < (ends[id] ?? Infinity)) ?? null;
  }
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now)) % 24;
  const hijri = hijriFromYmd(ymd, s.hijriOffset);
  return {
    now,
    tz,
    h12,
    today: ymdKey(ymd),
    ymd,
    times,
    next,
    current,
    hijri: hijriLabel(hijri),
    ramadan: hijri.m === 9,
    part: h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night',
  };
}
