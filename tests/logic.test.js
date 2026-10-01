import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hijriFromYmd, tabularHijri } from '../js/lib/hijri.js';
import { pickNudge } from '../js/lib/nudges.js';
import { streak, bestStreak, weekGrid, prayedCount } from '../js/lib/stats.js';
import { buildICS } from '../js/lib/ics.js';
import { addDays, countdown, ymdKey, zonedParts } from '../js/lib/time.js';
import { hydrate } from '../js/lib/store.js';

test('Umm al-Qura dates for Ramadan and Eid 1447', () => {
  assert.deepEqual(hijriFromYmd({ y: 2026, m: 2, d: 18 }), { y: 1447, m: 9, d: 1 });
  assert.deepEqual(hijriFromYmd({ y: 2026, m: 3, d: 20 }), { y: 1447, m: 10, d: 1 });
  assert.deepEqual(hijriFromYmd({ y: 2026, m: 2, d: 17 }, 1), { y: 1447, m: 9, d: 1 }, 'offset shifts a day');
});

test('tabular fallback stays within two days of Umm al-Qura', () => {
  for (let i = 0; i < 400; i += 7) {
    const date = addDays({ y: 2026, m: 1, d: 1 }, i);
    const a = hijriFromYmd(date);
    const b = tabularHijri(Date.UTC(date.y, date.m - 1, date.d, 12));
    const ord = (h) => h.y * 354.37 + (h.m - 1) * 29.53 + h.d;
    assert.ok(Math.abs(ord(a) - ord(b)) <= 2.5, `${ymdKey(date)}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
});

const base = {
  hijriToday: { y: 1448, m: 4, d: 20 },
  hijriTomorrow: { y: 1448, m: 4, d: 21 },
  weekday: 2,
  period: 'noon',
  afterMaghrib: false,
  beforeFajr: false,
  lastThird: null,
  now: 0,
  clock: () => '3:12 AM',
};

test('ordinary afternoon has no nudge', () => {
  assert.equal(pickNudge({ ...base, period: 'afternoon' }), null);
});

test('Friday daytime shows Jumuah; Thursday night shows Al-Kahf', () => {
  assert.match(pickNudge({ ...base, weekday: 5 }).text, /Jumuʿah/);
  assert.match(pickNudge({ ...base, weekday: 4, afterMaghrib: true }).text, /Al-Kahf/);
});

test('the Islamic day rolls over at Maghrib', () => {
  const eve = { ...base, hijriToday: { y: 1448, m: 4, d: 12 }, hijriTomorrow: { y: 1448, m: 4, d: 13 } };
  assert.equal(pickNudge({ ...eve, period: 'afternoon' }), null);
  assert.match(pickNudge({ ...eve, afterMaghrib: true }).text, /White Day is tomorrow/);
});

test('Ramadan last ten odd nights mention Laylat al-Qadr', () => {
  const r = { ...base, hijriToday: { y: 1448, m: 9, d: 26 }, hijriTomorrow: { y: 1448, m: 9, d: 27 }, afterMaghrib: true };
  assert.match(pickNudge(r).text, /Laylat al-Qadr/);
});

test('night falls back to the last third of the night', () => {
  const n = pickNudge({ ...base, beforeFajr: true, period: 'night', lastThird: 100, now: 50 });
  assert.match(n.text, /3:12 AM/);
});

test('streaks count complete days and ignore an unfinished today', () => {
  const full = { p: { fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 } };
  const days = { '2026-09-28': full, '2026-09-29': full, '2026-09-30': full, '2026-10-01': { p: { fajr: 1 } } };
  assert.equal(prayedCount(days['2026-10-01']), 1);
  assert.equal(streak(days, '2026-10-01'), 3);
  days['2026-10-01'] = full;
  assert.equal(streak(days, '2026-10-01'), 4);
  days['2026-09-26'] = full;
  assert.equal(bestStreak(days), 4);
});

test('week grid ends on the current week and marks the future', () => {
  const grid = weekGrid({}, '2026-10-01', 4); // a Thursday
  assert.equal(grid.length, 4);
  assert.equal(grid[3][0].key, '2026-09-28'); // Monday
  assert.equal(grid[3][3].future, false);
  assert.equal(grid[3][4].future, true);
});

test('calendar export is valid iCalendar with alarms', () => {
  const ics = buildICS([{ start: Date.UTC(2026, 9, 1, 4, 9), title: 'Fajr' }], { now: Date.UTC(2026, 9, 1) });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261001T040900Z\r\n/);
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('countdown formats', () => {
  assert.equal(countdown(3 * 3600000 + 5 * 60000), '3h 05m');
  assert.equal(countdown(12 * 60000 + 4000), '12:04');
  assert.equal(countdown(400), '0:01');
});

test('zoned parts respect the location time zone', () => {
  const p = zonedParts(Date.UTC(2026, 9, 1, 22, 30), 'Asia/Riyadh');
  assert.deepEqual([p.y, p.m, p.d, p.h, p.min], [2026, 10, 2, 1, 30]);
});

test('stored state is merged onto defaults', () => {
  const s = hydrate({ settings: { method: 'ISNA', goals: { quran: 10 } }, days: { x: 1 } });
  assert.equal(s.settings.method, 'ISNA');
  assert.equal(s.settings.goals.quran, 10);
  assert.equal(s.settings.goals.dhikr, 100);
  assert.equal(s.settings.asr, 'auto');
});
