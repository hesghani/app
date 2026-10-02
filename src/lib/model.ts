import type { AsrMethod, MethodId, PrayerId } from './praytimes';

export const AREAS = ['work', 'family', 'faith', 'health', 'growth', 'money'] as const;
export type AreaId = (typeof AREAS)[number];

export interface Task {
  id: string;
  title: string;
  area: AreaId;
  /** YYYY-MM-DD, or null for "someday". */
  date: string | null;
  /** HH:mm local time, or null for "anytime". */
  time: string | null;
  /** One of today's top three. */
  top: boolean;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

export interface Habit {
  id: string;
  title: string;
  area: AreaId;
  /** Times per day to count as done. */
  target: number;
  unit: string;
  archived: boolean;
  createdAt: number;
}

export interface Person {
  id: string;
  name: string;
  relation: string;
  /** Check in at least every N days. */
  everyDays: number;
  lastContact: number | null;
  phone: string;
  /** MM-DD */
  birthday: string | null;
  notes: string;
  createdAt: number;
}

export interface Checkin {
  /** 1 (rough) to 5 (great). */
  mood: number;
  energy: number;
  win: string;
  grateful: string;
  at: number;
}

export interface DayRecord {
  prayers: Partial<Record<PrayerId, number>>;
  habits: Record<string, number>;
  /** Focused minutes per life area. */
  focus: Partial<Record<AreaId, number>>;
  checkin?: Checkin;
}

export interface Review {
  scores: Record<AreaId, number>;
  focus: string;
  note: string;
  at: number;
}

export interface Place {
  name: string;
  country: string;
  lat: number;
  lng: number;
  tz: string;
}

export interface Settings {
  name: string;
  loc: Place | null;
  method: 'auto' | MethodId;
  asr: 'auto' | AsrMethod;
  clock: 'auto' | '12' | '24';
  hijriOffset: number;
  /** Show prayers on the Today timeline and track them. */
  prayerTimeline: boolean;
  prayerAlerts: boolean;
  /** HH:mm daily reminders, or null when off. */
  morningReminder: string | null;
  eveningReminder: string | null;
}

export interface FocusSession {
  start: number;
  end: number;
  label: string;
  area: AreaId;
  taskId: string | null;
  /** Prayer that closes the block, if it was capped at one. */
  until: PrayerId | null;
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const emptyDay = (): DayRecord => ({ prayers: {}, habits: {}, focus: {} });
