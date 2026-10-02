import { beforeEach, describe, expect, test } from '@jest/globals';
import { hijriFromYmd } from '@/lib/hijri';
import {
  buildTimeline,
  daysUntilBirthday,
  familyStatus,
  habitStreak,
  prayerStreak,
  tasksForToday,
  topThree,
  weekActivity,
} from '@/lib/logic';
import { emptyDay, type DayRecord, type Habit, type Person, type Task } from '@/lib/model';
import { prayerTimes } from '@/lib/praytimes';
import { countdown, weekKeys, weekStartKey, zonedInstant, zonedParts } from '@/lib/time';
import { initialState, useStore } from '@/store/store';

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2),
  title: 'Task',
  area: 'work',
  date: '2026-10-01',
  time: null,
  top: false,
  done: false,
  doneAt: null,
  createdAt: 0,
  ...over,
});

describe('today', () => {
  test('includes overdue work but not future or someday tasks', () => {
    const tasks = [
      task({ title: 'today' }),
      task({ title: 'overdue', date: '2026-09-28' }),
      task({ title: 'old done', date: '2026-09-28', done: true }),
      task({ title: 'tomorrow', date: '2026-10-02' }),
      task({ title: 'someday', date: null }),
    ];
    expect(tasksForToday(tasks, '2026-10-01').map((t) => t.title)).toEqual(['today', 'overdue']);
  });

  test('timeline weaves prayers between timed tasks', () => {
    const times = prayerTimes({ y: 2026, m: 10, d: 1 }, 51.5074, -0.1278);
    const tasks = [
      task({ title: 'Gym', time: '07:00', area: 'health' }),
      task({ title: 'Call Mom', time: '13:30', area: 'family' }),
      task({ title: 'No time' }),
    ];
    const order = buildTimeline(tasks, times, '2026-10-01', 'Europe/London', true).map((i) =>
      i.kind === 'prayer' ? i.label : i.task.title,
    );
    expect(order).toEqual(['Fajr', 'Gym', 'Dhuhr', 'Call Mom', 'Asr', 'Maghrib', 'Isha']);
    expect(buildTimeline(tasks, times, '2026-10-01', 'Europe/London', false)).toHaveLength(2);
  });
});

describe('store', () => {
  beforeEach(() => {
    useStore.setState(initialState());
  });

  test('top three caps at three', () => {
    const s = useStore.getState();
    const ids = ['a', 'b', 'c', 'd'].map((title) => s.addTask({ title, area: 'work', date: '2026-10-01', time: null }, '2026-10-01'));
    expect(ids.slice(0, 3).every((id) => useStore.getState().setTop(id, true, '2026-10-01'))).toBe(true);
    expect(useStore.getState().setTop(ids[3], true, '2026-10-01')).toBe(false);
    expect(topThree(useStore.getState().tasks, '2026-10-01')).toHaveLength(3);
  });

  test('starring a someday task schedules it for today', () => {
    const id = useStore.getState().addTask({ title: 'x', area: 'growth', date: null, time: null }, '2026-10-01');
    useStore.getState().setTop(id, true, '2026-10-01');
    expect(useStore.getState().tasks[0].date).toBe('2026-10-01');
  });

  test('focus books minutes against its life area, capped at the block end', () => {
    useStore.getState().startFocus({ start: 0, end: 25 * 60000, label: '', area: 'growth', taskId: null, until: null });
    const res = useStore.getState().endFocus('2026-10-01', 40 * 60000);
    expect(res?.minutes).toBe(25);
    expect(useStore.getState().days['2026-10-01'].focus.growth).toBe(25);
    expect(useStore.getState().focus).toBeNull();
  });

  test('habit counts never go below zero', () => {
    expect(useStore.getState().bumpHabit('2026-10-01', 'h', -1)).toBe(0);
    expect(useStore.getState().bumpHabit('2026-10-01', 'h', 3)).toBe(3);
  });

  test('prayers toggle on and off', () => {
    expect(useStore.getState().togglePrayer('2026-10-01', 'asr')).toBe(true);
    expect(useStore.getState().togglePrayer('2026-10-01', 'asr')).toBe(false);
    expect(useStore.getState().days['2026-10-01'].prayers.asr).toBeUndefined();
  });
});

describe('streaks', () => {
  const habit: Habit = { id: 'h', title: 'Read', area: 'growth', target: 10, unit: 'pages', archived: false, createdAt: 0 };
  const day = (pages: number): DayRecord => ({ ...emptyDay(), habits: { h: pages } });

  test('habit streak ignores an unfinished today', () => {
    const days = { '2026-09-29': day(10), '2026-09-30': day(12), '2026-10-01': day(3) };
    expect(habitStreak(days, habit, '2026-10-01')).toBe(2);
    days['2026-10-01'] = day(10);
    expect(habitStreak(days, habit, '2026-10-01')).toBe(3);
  });

  test('prayer streak counts complete days', () => {
    const full: DayRecord = { ...emptyDay(), prayers: { fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 } };
    expect(prayerStreak({ '2026-09-30': full, '2026-10-01': full }, '2026-10-01')).toBe(2);
  });
});

describe('family', () => {
  const person = (over: Partial<Person>): Person => ({
    id: 'p',
    name: 'Mom',
    relation: 'Mother',
    everyDays: 3,
    lastContact: null,
    phone: '',
    birthday: null,
    notes: '',
    createdAt: 0,
    ...over,
  });

  test('most overdue first', () => {
    const tz = 'Europe/London';
    const at = (key: string) => zonedInstant(key, '12:00', tz);
    const list = familyStatus(
      [
        person({ id: 'a', name: 'Brother', everyDays: 7, lastContact: at('2026-09-29') }),
        person({ id: 'b', name: 'Mom', everyDays: 2, lastContact: at('2026-09-25') }),
      ],
      '2026-10-01',
      tz,
    );
    expect(list.map((s) => s.person.name)).toEqual(['Mom', 'Brother']);
    expect(list[0].since).toBe(6);
    expect(list[0].due).toBe(true);
    expect(list[1].due).toBe(false);
  });

  test('birthday countdown wraps into next year', () => {
    expect(daysUntilBirthday('10-03', '2026-10-01')).toBe(2);
    expect(daysUntilBirthday('09-30', '2026-10-01')).toBe(364);
    expect(daysUntilBirthday('10-01', '2026-10-01')).toBe(0);
  });
});

describe('balance', () => {
  test('week activity sums tasks, habits, focus and prayers per area', () => {
    const tz = 'UTC';
    const keys = weekKeys('2026-10-01');
    const tasks = [task({ done: true, doneAt: Date.UTC(2026, 8, 30, 10), area: 'family' })];
    const habits: Habit[] = [{ id: 'w', title: 'Workout', area: 'health', target: 1, unit: '', archived: false, createdAt: 0 }];
    const days = { '2026-10-01': { ...emptyDay(), habits: { w: 1 }, focus: { work: 50 }, prayers: { fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 } } };
    const a = weekActivity(keys, tasks, habits, days, tz);
    expect(a).toMatchObject({ family: 1, health: 1, work: 2, faith: 1, growth: 0, money: 0 });
  });
});

describe('time', () => {
  test('weeks start on Monday', () => {
    expect(weekStartKey('2026-10-01')).toBe('2026-09-28');
    expect(weekStartKey('2026-09-28')).toBe('2026-09-28');
    expect(weekStartKey('2026-10-04')).toBe('2026-09-28');
  });

  test('zoned instants round-trip across DST zones', () => {
    const ms = zonedInstant('2026-10-01', '09:30', 'America/New_York');
    const p = zonedParts(ms, 'America/New_York');
    expect([p.h, p.min]).toEqual([9, 30]);
    expect(new Date(ms).toISOString()).toBe('2026-10-01T13:30:00.000Z');
  });

  test('countdown formats', () => {
    expect(countdown(3 * 3600000 + 5 * 60000)).toBe('3h 05m');
    expect(countdown(12 * 60000 + 4000)).toBe('12:04');
  });

  test('Umm al-Qura Ramadan 1447 starts on 18 February 2026', () => {
    expect(hijriFromYmd({ y: 2026, m: 2, d: 18 })).toEqual({ y: 1447, m: 9, d: 1 });
  });
});
