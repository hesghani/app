// Prayer-time engine.
// Astronomy follows the method popularised by PrayTimes.org (Hamid Zarrabi-Zadeh),
// rewritten as a small pure module. Every prayer time is a sun angle; this file
// turns angles into instants (UTC milliseconds) for one calendar day at one place.

const RAD = Math.PI / 180;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);
const tan = (d: number) => Math.tan(d * RAD);
const asin = (x: number) => Math.asin(x) / RAD;
const acos = (x: number) => Math.acos(x) / RAD;
const atan2 = (y: number, x: number) => Math.atan2(y, x) / RAD;
const acot = (x: number) => Math.atan(1 / x) / RAD;
const wrap = (a: number, b: number) => a - b * Math.floor(a / b);
const fixAngle = (a: number) => wrap(a, 360);
const fixHour = (a: number) => wrap(a, 24);
const span = (from: number, to: number) => fixHour(to - from);

export type MethodId =
  | 'MWL'
  | 'ISNA'
  | 'Egypt'
  | 'Makkah'
  | 'Karachi'
  | 'Turkey'
  | 'Dubai'
  | 'Gulf'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'France'
  | 'Russia'
  | 'Tehran'
  | 'Jafari';

export type AsrMethod = 'standard' | 'hanafi';

interface Method {
  name: string;
  /** Sun depression angle in degrees. */
  fajr: number;
  /** Depression angle, or "N min" after Maghrib. */
  isha: number | string;
  maghrib?: number | string;
  midnight?: 'Standard' | 'Jafari';
}

export const METHODS: Record<MethodId, Method> = {
  MWL: { name: 'Muslim World League', fajr: 18, isha: 17 },
  ISNA: { name: 'ISNA · North America', fajr: 15, isha: 15 },
  Egypt: { name: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
  Makkah: { name: 'Umm al-Qura · Makkah', fajr: 18.5, isha: '90 min' },
  Karachi: { name: 'University of Karachi', fajr: 18, isha: 18 },
  Turkey: { name: 'Diyanet · Türkiye', fajr: 18, isha: 17 },
  Dubai: { name: 'Dubai', fajr: 18.2, isha: 18.2 },
  Gulf: { name: 'Gulf Region', fajr: 19.5, isha: '90 min' },
  Kuwait: { name: 'Kuwait', fajr: 18, isha: 17.5 },
  Qatar: { name: 'Qatar', fajr: 18, isha: '90 min' },
  Singapore: { name: 'MUIS · Singapore, Malaysia, Indonesia', fajr: 20, isha: 18 },
  France: { name: 'UOIF · France', fajr: 12, isha: 12 },
  Russia: { name: 'Spiritual Administration · Russia', fajr: 16, isha: 15 },
  Tehran: { name: 'Institute of Geophysics · Tehran', fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' },
  Jafari: { name: 'Shia Ithna Ashari · Qum', fajr: 16, isha: 14, maghrib: 4, midnight: 'Jafari' },
};

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerId = (typeof PRAYERS)[number];

export const PRAYER_NAMES: Record<PrayerId, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export interface PrayerTimes {
  imsak: number | null;
  fajr: number | null;
  sunrise: number | null;
  dhuhr: number | null;
  asr: number | null;
  sunset: number | null;
  maghrib: number | null;
  isha: number | null;
  midnight: number | null;
  lastThird: number | null;
}

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

const isMinutes = (v: unknown): v is string => typeof v === 'string' && v.includes('min');
const num = (v: number | string | undefined) => parseFloat(String(v ?? 0));

export function julian(y: number, m: number, d: number) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/** Sun declination (degrees) and equation of time (hours) for a Julian date. */
export function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  return { declination: asin(sin(e) * sin(L)), equation: q / 15 - fixHour(RA) };
}

type SolarKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'sunset' | 'maghrib' | 'isha';
type Hours = Record<SolarKey, number>;

export interface PrayerOptions {
  method?: MethodId;
  asr?: AsrMethod;
  /** Override Isha, e.g. "120 min" during Ramadan for Umm al-Qura. */
  isha?: string | number;
  highLats?: 'AngleBased' | 'OneSeventh' | 'NightMiddle' | 'None';
}

/** Prayer times for one local calendar day, as UTC instants (ms). null when the sun never reaches the angle. */
export function prayerTimes({ y, m, d }: Ymd, lat: number, lng: number, opts: PrayerOptions = {}): PrayerTimes {
  const method = METHODS[opts.method ?? 'MWL'] ?? METHODS.MWL;
  const fajrAngle = method.fajr;
  const isha = opts.isha ?? method.isha;
  const maghrib = method.maghrib ?? '0 min';
  const asrFactor = opts.asr === 'hanafi' ? 2 : 1;
  const highLats = opts.highLats ?? 'AngleBased';
  const jDate = julian(y, m, d) - lng / (15 * 24);
  const riseSet = 0.833;

  const midDay = (t: number) => fixHour(12 - sunPosition(jDate + t).equation);
  const angleTime = (angle: number, t: number, before = false) => {
    const decl = sunPosition(jDate + t).declination;
    const v = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (before ? -v : v);
  };
  const asrTime = (t: number) => {
    const decl = sunPosition(jDate + t).declination;
    return angleTime(-acot(asrFactor + tan(Math.abs(lat - decl))), t);
  };

  const solve = (g: Hours): Hours => ({
    fajr: angleTime(fajrAngle, g.fajr / 24, true),
    sunrise: angleTime(riseSet, g.sunrise / 24, true),
    dhuhr: midDay(g.dhuhr / 24),
    asr: asrTime(g.asr / 24),
    sunset: angleTime(riseSet, g.sunset / 24),
    maghrib: isMinutes(maghrib) ? NaN : angleTime(num(maghrib), g.maghrib / 24),
    isha: isMinutes(isha) ? NaN : angleTime(num(isha), g.isha / 24),
  });

  // Two passes: rough guesses first, then refine using the first answers.
  const guess: Hours = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
  const first = solve(guess);
  const refined = { ...guess };
  for (const k of Object.keys(first) as SolarKey[]) if (Number.isFinite(first[k])) refined[k] = first[k];
  const t = solve(refined);

  // Hours are local mean time at longitude 0 so far; shift to UTC.
  for (const k of Object.keys(t) as SolarKey[]) t[k] -= lng / 15;

  if (highLats !== 'None') {
    const night = span(t.sunset, t.sunrise);
    const portion = (angle: number) =>
      (highLats === 'AngleBased' ? angle / 60 : highLats === 'OneSeventh' ? 1 / 7 : 1 / 2) * night;
    const adjust = (time: number, base: number, angle: number, before = false) => {
      const limit = portion(angle);
      const gap = before ? span(time, base) : span(base, time);
      return Number.isNaN(time) || gap > limit ? base + (before ? -limit : limit) : time;
    };
    t.fajr = adjust(t.fajr, t.sunrise, fajrAngle, true);
    if (!isMinutes(isha)) t.isha = adjust(t.isha, t.sunset, num(isha));
    if (!isMinutes(maghrib)) t.maghrib = adjust(t.maghrib, t.sunset, num(maghrib));
  }

  if (isMinutes(maghrib)) t.maghrib = t.sunset + num(maghrib) / 60;
  if (isMinutes(isha)) t.isha = t.maghrib + num(isha) / 60;

  const hours: Record<keyof PrayerTimes, number> = {
    ...t,
    imsak: t.fajr - 10 / 60,
    midnight:
      method.midnight === 'Jafari' ? t.sunset + span(t.sunset, t.fajr) / 2 : t.sunset + span(t.sunset, t.sunrise) / 2,
    // The night for qiyam runs from sunset to Fajr; its last third is the best time for dua.
    lastThird: t.sunset + (span(t.sunset, t.fajr) * 2) / 3,
  };

  const base = Date.UTC(y, m - 1, d);
  const out = {} as PrayerTimes;
  for (const k of Object.keys(hours) as (keyof PrayerTimes)[]) {
    out[k] = Number.isFinite(hours[k]) ? base + Math.round(hours[k] * 60) * 60000 : null;
  }
  return out;
}

/** Current solar altitude in degrees (negative = below the horizon). */
export function sunAltitude(ms: number, lat: number, lng: number) {
  const { declination, equation } = sunPosition(ms / 86400000 + 2440587.5);
  const hourAngle = (wrap(ms / 3600000, 24) + lng / 15 + equation - 12) * 15;
  return asin(sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle));
}

export const KAABA = { lat: 21.4225, lng: 39.8262 };

/** Initial great-circle bearing to the Kaaba, degrees clockwise from true north. */
export function qiblaBearing(lat: number, lng: number) {
  const dL = KAABA.lng - lng;
  return fixAngle(atan2(sin(dL), cos(lat) * tan(KAABA.lat) - sin(lat) * cos(dL)));
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Sensible regional defaults so most people never open settings.
const TZ_METHOD: [RegExp, MethodId][] = [
  [/^(America|US|Canada)\//, 'ISNA'],
  [/^Asia\/(Riyadh|Aden)$/, 'Makkah'],
  [/^Asia\/Dubai$/, 'Dubai'],
  [/^Asia\/(Muscat|Bahrain)$/, 'Gulf'],
  [/^Asia\/Qatar$/, 'Qatar'],
  [/^Asia\/Kuwait$/, 'Kuwait'],
  [/^(Africa\/(Cairo|Khartoum|Tripoli|Juba)|Asia\/(Beirut|Damascus|Amman|Baghdad|Gaza|Hebron|Jerusalem))$/, 'Egypt'],
  [/^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul|Colombo|Kathmandu|Thimphu)$/, 'Karachi'],
  [/^Asia\/Tehran$/, 'Tehran'],
  [/^(Europe|Asia)\/Istanbul$/, 'Turkey'],
  [/^Asia\/(Singapore|Kuala_Lumpur|Kuching|Jakarta|Makassar|Jayapura|Pontianak|Brunei)$/, 'Singapore'],
  [/^(Europe\/(Moscow|Kazan|Samara|Volgograd|Ulyanovsk|Kirov)|Asia\/(Yekaterinburg|Omsk|Novosibirsk))$/, 'Russia'],
];

export function methodForTimeZone(tz = ''): MethodId {
  for (const [re, id] of TZ_METHOD) if (re.test(tz)) return id;
  return 'MWL';
}

export function asrForTimeZone(tz = ''): AsrMethod {
  return /^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul)$/.test(tz) ? 'hanafi' : 'standard';
}
