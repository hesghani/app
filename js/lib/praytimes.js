// Prayer-time engine.
// Astronomy follows the method popularised by PrayTimes.org (Hamid Zarrabi-Zadeh),
// rewritten as a small pure module. Every prayer time is a sun angle; this file
// turns angles into instants (UTC milliseconds) for one calendar day at one place.

const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const tan = (d) => Math.tan(d * RAD);
const asin = (x) => Math.asin(x) / RAD;
const acos = (x) => Math.acos(x) / RAD;
const atan2 = (y, x) => Math.atan2(y, x) / RAD;
const acot = (x) => Math.atan(1 / x) / RAD;
const wrap = (a, b) => a - b * Math.floor(a / b);
const fixAngle = (a) => wrap(a, 360);
const fixHour = (a) => wrap(a, 24);
const span = (from, to) => fixHour(to - from);

// fajr / isha are sun depression angles in degrees, or "N min" after maghrib.
export const METHODS = {
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

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const isMinutes = (v) => typeof v === 'string' && v.includes('min');
const num = (v) => parseFloat(v);

export function julian(y, m, d) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

// Sun declination (deg) and equation of time (hours) for a Julian date.
export function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  return {
    declination: asin(sin(e) * sin(L)),
    equation: q / 15 - fixHour(RA),
  };
}

/**
 * Prayer times for one local calendar day.
 * @param {{y:number,m:number,d:number}} date  local calendar date at the location
 * @param {number} lat
 * @param {number} lng
 * @param {{method?:string, asr?:'standard'|'hanafi', isha?:string|number, highLats?:string}} [opts]
 * @returns {Record<string, number|null>} UTC ms for imsak, fajr, sunrise, dhuhr, asr,
 *   sunset, maghrib, isha, midnight, lastThird. null when the sun never reaches the angle.
 */
export function prayerTimes({ y, m, d }, lat, lng, opts = {}) {
  const method = METHODS[opts.method] ?? METHODS.MWL;
  const p = { imsak: '10 min', maghrib: '0 min', midnight: 'Standard', ...method };
  if (opts.isha != null) p.isha = opts.isha;
  const asrFactor = opts.asr === 'hanafi' ? 2 : 1;
  const highLats = opts.highLats ?? 'AngleBased';
  const jDate = julian(y, m, d) - lng / (15 * 24);
  const riseSet = 0.833;

  const midDay = (t) => fixHour(12 - sunPosition(jDate + t).equation);
  const angleTime = (angle, t, before) => {
    const decl = sunPosition(jDate + t).declination;
    const v = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (before ? -v : v);
  };
  const asrTime = (t) => {
    const decl = sunPosition(jDate + t).declination;
    return angleTime(-acot(asrFactor + tan(Math.abs(lat - decl))), t);
  };

  const solve = (g) => ({
    fajr: angleTime(num(p.fajr), g.fajr / 24, true),
    sunrise: angleTime(riseSet, g.sunrise / 24, true),
    dhuhr: midDay(g.dhuhr / 24),
    asr: asrTime(g.asr / 24),
    sunset: angleTime(riseSet, g.sunset / 24),
    maghrib: isMinutes(p.maghrib) ? NaN : angleTime(num(p.maghrib), g.maghrib / 24),
    isha: isMinutes(p.isha) ? NaN : angleTime(num(p.isha), g.isha / 24),
  });

  // Two passes: rough guesses first, then refine using the first answers.
  const guess = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
  let t = solve(guess);
  t = solve(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Number.isFinite(v) ? v : guess[k]])));

  // Hours are local mean time at longitude 0 so far; shift to UTC.
  for (const k in t) t[k] -= lng / 15;

  if (highLats !== 'None') {
    const night = span(t.sunset, t.sunrise);
    const portion = (angle) =>
      (highLats === 'AngleBased' ? angle / 60 : highLats === 'OneSeventh' ? 1 / 7 : 1 / 2) * night;
    const adjust = (time, base, angle, before) => {
      const limit = portion(angle);
      const gap = before ? span(time, base) : span(base, time);
      return Number.isNaN(time) || gap > limit ? base + (before ? -limit : limit) : time;
    };
    t.fajr = adjust(t.fajr, t.sunrise, num(p.fajr), true);
    if (!isMinutes(p.isha)) t.isha = adjust(t.isha, t.sunset, num(p.isha));
    if (!isMinutes(p.maghrib)) t.maghrib = adjust(t.maghrib, t.sunset, num(p.maghrib));
  }

  t.imsak = t.fajr - num(p.imsak) / 60;
  if (isMinutes(p.maghrib)) t.maghrib = t.sunset + num(p.maghrib) / 60;
  if (isMinutes(p.isha)) t.isha = t.maghrib + num(p.isha) / 60;

  t.midnight =
    p.midnight === 'Jafari' ? t.sunset + span(t.sunset, t.fajr) / 2 : t.sunset + span(t.sunset, t.sunrise) / 2;
  // The night for qiyam runs from sunset to Fajr; its last third is the best time for dua.
  t.lastThird = t.sunset + (span(t.sunset, t.fajr) * 2) / 3;

  const base = Date.UTC(y, m - 1, d);
  const out = {};
  for (const k in t) out[k] = Number.isFinite(t[k]) ? base + Math.round(t[k] * 60) * 60000 : null;
  return out;
}

// Current solar altitude in degrees (negative = below the horizon).
export function sunAltitude(ms, lat, lng) {
  const jd = ms / 86400000 + 2440587.5;
  const { declination, equation } = sunPosition(jd);
  const utcHours = wrap(ms / 3600000, 24);
  const hourAngle = (utcHours + lng / 15 + equation - 12) * 15;
  return asin(sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle));
}

export const KAABA = { lat: 21.4225, lng: 39.8262 };

// Initial great-circle bearing to the Kaaba, degrees clockwise from true north.
export function qiblaBearing(lat, lng) {
  const dL = KAABA.lng - lng;
  return fixAngle(atan2(sin(dL), cos(lat) * tan(KAABA.lat) - sin(lat) * cos(dL)));
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Sensible regional defaults so most people never open settings.
const TZ_METHOD = [
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

export function methodForTimeZone(tz = '') {
  for (const [re, id] of TZ_METHOD) if (re.test(tz)) return id;
  return 'MWL';
}

export function asrForTimeZone(tz = '') {
  return /^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul)$/.test(tz) ? 'hanafi' : 'standard';
}
