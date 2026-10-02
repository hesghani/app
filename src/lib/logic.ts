// Pure rules for the planner: what shows on Today, who to call, streaks and balance.

import { AREAS, type AreaId, type DayRecord, type Habit, type Person, type Task } from './model';
import { PRAYERS, PRAYER_NAMES, type PrayerId, type PrayerTimes } from './praytimes';
import { addDaysKey, daysBetween, hmToMinutes, keyYmd, minutesOfDay, todayKey } from './time';

// ---------- tasks ----------

export const TOP_LIMIT = 3;

export const isOverdue = (t: Task, today: string) => !t.done && t.date != null && t.date < today;

/** Today's list: tasks dated today plus anything overdue, not done first. */
export function tasksForToday(tasks: Task[], today: string) {
  return tasks.filter((t) => t.date === today || isOverdue(t, today));
}

export const topThree = (tasks: Task[], today: string) =>
  tasks.filter((t) => t.top && (t.date === today || isOverdue(t, today))).slice(0, TOP_LIMIT);

export function upcoming(tasks: Task[], today: string) {
  return tasks
    .filter((t) => !t.done && t.date != null && t.date > today)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : (a.time ?? '99').localeCompare(b.time ?? '99')));
}

export const someday = (tasks: Task[]) => tasks.filter((t) => !t.done && t.date == null);

export type TimelineItem =
  | { kind: 'prayer'; id: PrayerId; minutes: number; at: number; label: string }
  | { kind: 'task'; task: Task; minutes: number };

/** Prayers and timed tasks woven into one chronological day. */
export function buildTimeline(tasks: Task[], times: PrayerTimes | null, today: string, tz: string, withPrayers: boolean) {
  const items: TimelineItem[] = [];
  if (withPrayers && times) {
    for (const id of PRAYERS) {
      const at = times[id];
      if (at != null) items.push({ kind: 'prayer', id, at, minutes: minutesOfDay(at, tz), label: PRAYER_NAMES[id] });
    }
  }
  for (const t of tasks) {
    if (t.date === today && t.time) items.push({ kind: 'task', task: t, minutes: hmToMinutes(t.time) });
  }
  return items.sort((a, b) => a.minutes - b.minutes || (a.kind === 'prayer' ? -1 : 1));
}

// ---------- habits ----------

export const habitCount = (days: Record<string, DayRecord>, key: string, habitId: string) => days[key]?.habits[habitId] ?? 0;

/** Consecutive days meeting the target. An unfinished today never breaks the streak. */
export function habitStreak(days: Record<string, DayRecord>, habit: Habit, today: string) {
  const met = (k: string) => habitCount(days, k, habit.id) >= habit.target;
  let n = met(today) ? 1 : 0;
  let k = addDaysKey(today, -1);
  while (met(k)) {
    n++;
    k = addDaysKey(k, -1);
  }
  return n;
}

// ---------- prayers ----------

export const prayedCount = (rec: DayRecord | undefined) => PRAYERS.filter((id) => rec?.prayers[id]).length;

export function prayerStreak(days: Record<string, DayRecord>, today: string) {
  let n = prayedCount(days[today]) === 5 ? 1 : 0;
  let k = addDaysKey(today, -1);
  while (prayedCount(days[k]) === 5) {
    n++;
    k = addDaysKey(k, -1);
  }
  return n;
}

// ---------- family ----------

export function daysSince(ms: number | null, today: string, tz: string) {
  if (ms == null) return null;
  return daysBetween(todayKey(tz, ms), today);
}

export interface PersonStatus {
  person: Person;
  since: number | null;
  /** 0 = just contacted, 1 = due today, >1 = overdue. */
  pressure: number;
  due: boolean;
  birthdayIn: number | null;
}

/** Days until the next MM-DD birthday, counting today as 0. */
export function daysUntilBirthday(mmdd: string | null, today: string) {
  if (!mmdd) return null;
  const [m, d] = mmdd.split('-').map(Number);
  const { y } = keyYmd(today);
  const pad = (n: number) => String(n).padStart(2, '0');
  let next = `${y}-${pad(m)}-${pad(d)}`;
  if (next < today) next = `${y + 1}-${pad(m)}-${pad(d)}`;
  return daysBetween(today, next);
}

export function familyStatus(people: Person[], today: string, tz: string): PersonStatus[] {
  return people
    .map((person) => {
      const since = daysSince(person.lastContact, today, tz);
      const pressure = since == null ? 1.5 : since / Math.max(1, person.everyDays);
      return { person, since, pressure, due: pressure >= 1, birthdayIn: daysUntilBirthday(person.birthday, today) };
    })
    .sort((a, b) => b.pressure - a.pressure);
}

// ---------- balance ----------

/** Where the week actually went: completed tasks, met habits and focus time per life area. */
export function weekActivity(
  keys: string[],
  tasks: Task[],
  habits: Habit[],
  days: Record<string, DayRecord>,
  tz: string,
) {
  const out = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<AreaId, number>;
  const inWeek = new Set(keys);
  for (const t of tasks) if (t.done && t.doneAt && inWeek.has(todayKey(tz, t.doneAt))) out[t.area] += 1;
  for (const k of keys) {
    const rec = days[k];
    if (!rec) continue;
    for (const h of habits) if ((rec.habits[h.id] ?? 0) >= h.target) out[h.area] += 1;
    for (const a of AREAS) out[a] += Math.floor((rec.focus[a] ?? 0) / 25);
    out.faith += prayedCount(rec) / 5;
  }
  for (const a of AREAS) out[a] = Math.round(out[a] * 10) / 10;
  return out;
}
