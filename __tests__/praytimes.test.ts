import { expect, test } from '@jest/globals';
import {
  prayerTimes,
  qiblaBearing,
  distanceKm,
  sunAltitude,
  methodForTimeZone,
  asrForTimeZone,
  METHODS,
  PRAYERS,
} from '@/lib/praytimes';
import type { MethodId, Ymd } from '@/lib/praytimes';

const assert = {
  ok: (v: unknown, msg?: string) => {
    if (!v) throw new Error(msg ?? 'assertion failed');
  },
  equal: (a: unknown, b: unknown) => expect(a).toBe(b),
};

// Independent NOAA solar calculator, used only to cross-check sunrise, noon and sunset.
function noaa({ y, m, d }: Ymd, lat: number, lng: number) {
  const rad = Math.PI / 180;
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * rad) * 0.000289;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos((125.04 - 1934.136 * T) * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) / rad;
  const yv = Math.tan((eps / 2) * rad) ** 2;
  const eqTime =
    (4 / rad) *
    (yv * Math.sin(2 * L0 * rad) -
      2 * e * Math.sin(M * rad) +
      4 * e * yv * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
      0.5 * yv * yv * Math.sin(4 * L0 * rad) -
      1.25 * e * e * Math.sin(2 * M * rad));
  const ha =
    Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl * rad)) - Math.tan(lat * rad) * Math.tan(decl * rad)) /
    rad;
  const noonMin = 720 - 4 * lng - eqTime;
  const base = Date.UTC(y, m - 1, d);
  return {
    sunrise: base + (noonMin - 4 * ha) * 60000,
    dhuhr: base + noonMin * 60000,
    sunset: base + (noonMin + 4 * ha) * 60000,
  };
}

const CITIES: [string, number, number][] = [
  ['London', 51.5074, -0.1278],
  ['Makkah', 21.4225, 39.8262],
  ['New York', 40.7128, -74.006],
  ['Jakarta', -6.2088, 106.8456],
  ['Sydney', -33.8688, 151.2093],
  ['Honolulu', 21.3069, -157.8583],
  ['Auckland', -36.8485, 174.7633],
];
const DATES: Ymd[] = [
  { y: 2026, m: 1, d: 15 },
  { y: 2026, m: 3, d: 20 },
  { y: 2026, m: 6, d: 21 },
  { y: 2026, m: 10, d: 1 },
  { y: 2027, m: 12, d: 21 },
];

test('sunrise, noon and sunset agree with NOAA within 2 minutes', () => {
  for (const [name, lat, lng] of CITIES) {
    for (const date of DATES) {
      const t = prayerTimes(date, lat, lng);
      const ref = noaa(date, lat, lng);
      for (const k of ['sunrise', 'dhuhr', 'sunset'] as const) {
        const diffMin = Math.abs(t[k]! - ref[k]) / 60000;
        assert.ok(diffMin < 2, `${name} ${JSON.stringify(date)} ${k} off by ${diffMin.toFixed(2)} min`);
      }
    }
  }
});

test('prayers fall in order for every method', () => {
  for (const method of Object.keys(METHODS) as MethodId[]) {
    for (const [name, lat, lng] of CITIES) {
      const t = prayerTimes({ y: 2026, m: 10, d: 1 }, lat, lng, { method });
      const order = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha', 'midnight'] as const;
      for (let i = 1; i < order.length; i++) {
        assert.ok(t[order[i - 1]]! <= t[order[i]]!, `${method} ${name}: ${order[i - 1]} should precede ${order[i]}`);
      }
      assert.ok(t.lastThird! > t.isha! || method === 'Makkah', `${method} ${name}: last third after isha`);
    }
  }
});

test('Makkah on 1 Oct 2026 lands on the expected local clock times', () => {
  const t = prayerTimes({ y: 2026, m: 10, d: 1 }, 21.4225, 39.8262, { method: 'Makkah' });
  const local = (ms: number | null) => new Date(ms! + 3 * 3600000).toISOString().slice(11, 16); // Asia/Riyadh is UTC+3
  assert.equal(local(t.dhuhr), '12:10');
  assert.equal(local(t.isha), '19:39'); // 90 minutes after Maghrib
  assert.equal(t.isha! - t.maghrib!, 90 * 60000);
});

test('Hanafi Asr is later than standard Asr', () => {
  const date = { y: 2026, m: 10, d: 1 };
  const std = prayerTimes(date, 24.8607, 67.0011, { asr: 'standard' });
  const han = prayerTimes(date, 24.8607, 67.0011, { asr: 'hanafi' });
  assert.ok(han.asr! - std.asr! > 30 * 60000);
});

test('high latitudes in midsummer still produce Fajr and Isha', () => {
  const t = prayerTimes({ y: 2026, m: 6, d: 21 }, 59.9139, 10.7522, { method: 'MWL' });
  for (const k of PRAYERS) assert.ok(Number.isFinite(t[k]), `${k} should be finite`);
  assert.ok(t.fajr! < t.sunrise! && t.isha! > t.sunset!);
});

test('Ramadan override can push Isha to 120 minutes', () => {
  const t = prayerTimes({ y: 2026, m: 2, d: 20 }, 21.4225, 39.8262, { method: 'Makkah', isha: '120 min' });
  assert.equal(t.isha! - t.maghrib!, 120 * 60000);
});

test('qibla bearings match published values', () => {
  assert.ok(Math.abs(qiblaBearing(51.5074, -0.1278) - 118.99) < 0.1, 'London');
  assert.ok(Math.abs(qiblaBearing(40.7128, -74.006) - 58.48) < 0.1, 'New York');
  assert.ok(Math.abs(qiblaBearing(-6.2088, 106.8456) - 295.15) < 0.2, 'Jakarta');
  assert.ok(Math.abs(distanceKm(51.5074, -0.1278, 21.4225, 39.8262) - 4790) < 30, 'London to Makkah');
});

test('sun altitude is high at noon and negative at midnight', () => {
  const t = prayerTimes({ y: 2026, m: 10, d: 1 }, 51.5074, -0.1278);
  assert.ok(sunAltitude(t.dhuhr!, 51.5074, -0.1278) > 30);
  assert.ok(sunAltitude(t.midnight!, 51.5074, -0.1278) < -30);
  assert.ok(Math.abs(sunAltitude(t.sunrise!, 51.5074, -0.1278) + 0.833) < 0.3);
});

test('time zones pick regional defaults', () => {
  assert.equal(methodForTimeZone('America/Chicago'), 'ISNA');
  assert.equal(methodForTimeZone('Asia/Riyadh'), 'Makkah');
  assert.equal(methodForTimeZone('Europe/Istanbul'), 'Turkey');
  assert.equal(methodForTimeZone('Asia/Kuala_Lumpur'), 'Singapore');
  assert.equal(methodForTimeZone('Europe/London'), 'MWL');
  assert.equal(asrForTimeZone('Asia/Karachi'), 'hanafi');
  assert.equal(asrForTimeZone('Africa/Cairo'), 'standard');
});
