import { addDays, keyYmd, ymdKey } from './time.js';
import { PRAYERS } from './praytimes.js';

export const prayedCount = (rec) => (rec?.p ? PRAYERS.reduce((n, id) => n + (rec.p[id] ? 1 : 0), 0) : 0);
const complete = (rec) => prayedCount(rec) === PRAYERS.length;

// Consecutive days with all five prayers. Today only counts once it's complete;
// an unfinished today never breaks the streak.
export function streak(days, todayKey) {
  let n = complete(days[todayKey]) ? 1 : 0;
  let cur = addDays(keyYmd(todayKey), -1);
  while (complete(days[ymdKey(cur)])) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

export function bestStreak(days) {
  const keys = Object.keys(days).filter((k) => complete(days[k])).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && ymdKey(addDays(keyYmd(prev), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export function lastDays(todayKey, n) {
  const start = keyYmd(todayKey);
  return Array.from({ length: n }, (_, i) => ymdKey(addDays(start, i - n + 1)));
}

export const sum = (days, keys, field) => keys.reduce((t, k) => t + (days[k]?.[field] || 0), 0);

// Columns of weeks (Monday first) ending with the current week. Future cells are marked.
export function weekGrid(days, todayKey, weeks = 15) {
  const today = keyYmd(todayKey);
  const wd = (new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(today, -wd - (weeks - 1) * 7);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const key = ymdKey(addDays(start, w * 7 + i));
      col.push({ key, count: prayedCount(days[key]), future: key > todayKey });
    }
    cols.push(col);
  }
  return cols;
}
