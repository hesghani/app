import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { HabitPreset } from '@/data/presets';
import { TOP_LIMIT, topThree } from '@/lib/logic';
import {
  emptyDay,
  newId,
  type AreaId,
  type Checkin,
  type DayRecord,
  type FocusSession,
  type Habit,
  type Person,
  type Place,
  type Review,
  type Settings,
  type Task,
} from '@/lib/model';
import type { PrayerId } from '@/lib/praytimes';

export interface State {
  onboarded: boolean;
  settings: Settings;
  tasks: Task[];
  habits: Habit[];
  people: Person[];
  days: Record<string, DayRecord>;
  /** Weekly reviews keyed by the Monday that starts the week. */
  reviews: Record<string, Review>;
  focus: FocusSession | null;
  dhikr: { sel: string; count: number };
}

export type NewTask = Pick<Task, 'title' | 'area' | 'date' | 'time'> & { top?: boolean };
export type NewPerson = Omit<Person, 'id' | 'createdAt' | 'lastContact'>;

interface Actions {
  completeOnboarding(p: { name: string; loc: Place | null; presets: HabitPreset[] }): void;
  updateSettings(patch: Partial<Settings>): void;

  addTask(t: NewTask, today: string): string;
  updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): void;
  toggleTask(id: string): void;
  deleteTask(id: string): void;
  /** Returns false when today's top three is already full. */
  setTop(id: string, top: boolean, today: string): boolean;

  addHabit(h: Pick<Habit, 'title' | 'area' | 'target' | 'unit'>): void;
  updateHabit(id: string, patch: Partial<Omit<Habit, 'id'>>): void;
  archiveHabit(id: string): void;
  bumpHabit(key: string, id: string, delta: number): number;

  addPerson(p: NewPerson): string;
  updatePerson(id: string, patch: Partial<Omit<Person, 'id'>>): void;
  deletePerson(id: string): void;
  logContact(id: string, at?: number): void;

  togglePrayer(key: string, id: PrayerId): boolean;
  saveCheckin(key: string, c: Omit<Checkin, 'at'>): void;
  saveReview(weekKey: string, r: Omit<Review, 'at'>): void;

  startFocus(s: FocusSession): void;
  /** Ends the running block and books its minutes. Returns the minutes logged. */
  endFocus(key: string, now?: number): { minutes: number; session: FocusSession } | null;

  setDhikr(d: Partial<State['dhikr']>): void;
  resetAll(): void;
}

export const defaultSettings = (): Settings => ({
  name: '',
  loc: null,
  method: 'auto',
  asr: 'auto',
  clock: 'auto',
  hijriOffset: 0,
  prayerTimeline: true,
  prayerAlerts: true,
  morningReminder: '07:30',
  eveningReminder: '21:30',
});

export const initialState = (): State => ({
  onboarded: false,
  settings: defaultSettings(),
  tasks: [],
  habits: [],
  people: [],
  days: {},
  reviews: {},
  focus: null,
  dhikr: { sel: 'subhanallah', count: 0 },
});

const withDay = (days: Record<string, DayRecord>, key: string, fn: (d: DayRecord) => DayRecord) => ({
  ...days,
  [key]: fn(days[key] ?? emptyDay()),
});

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initialState(),

      completeOnboarding: ({ name, loc, presets }) =>
        set((s) => ({
          onboarded: true,
          settings: { ...s.settings, name: name.trim(), loc },
          habits: [
            ...s.habits,
            ...presets.map((p) => ({ ...p, id: newId(), archived: false, createdAt: Date.now() })),
          ],
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addTask: (t, today) => {
        const id = newId();
        const full = topThree(get().tasks, today).length >= TOP_LIMIT;
        const task: Task = {
          id,
          title: t.title.trim(),
          area: t.area,
          date: t.date,
          time: t.time,
          top: !!t.top && !full && t.date === today,
          done: false,
          doneAt: null,
          createdAt: Date.now(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return id;
      },

      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t)),
        })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      setTop: (id, top, today) => {
        if (top && topThree(get().tasks, today).length >= TOP_LIMIT) return false;
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, top, date: top && (t.date == null || t.date < today) ? today : t.date } : t)),
        }));
        return true;
      },

      addHabit: (h) =>
        set((s) => ({ habits: [...s.habits, { ...h, id: newId(), archived: false, createdAt: Date.now() }] })),

      updateHabit: (id, patch) => set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),

      archiveHabit: (id) => set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)) })),

      bumpHabit: (key, id, delta) => {
        const next = Math.max(0, (get().days[key]?.habits[id] ?? 0) + delta);
        set((s) => ({ days: withDay(s.days, key, (d) => ({ ...d, habits: { ...d.habits, [id]: next } })) }));
        return next;
      },

      addPerson: (p) => {
        const id = newId();
        set((s) => ({ people: [...s.people, { ...p, id, lastContact: null, createdAt: Date.now() }] }));
        return id;
      },

      updatePerson: (id, patch) => set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      deletePerson: (id) => set((s) => ({ people: s.people.filter((p) => p.id !== id) })),

      logContact: (id, at = Date.now()) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, lastContact: at } : p)) })),

      togglePrayer: (key, id) => {
        const on = !get().days[key]?.prayers[id];
        set((s) => ({
          days: withDay(s.days, key, (d) => {
            const prayers = { ...d.prayers };
            if (on) prayers[id] = Date.now();
            else delete prayers[id];
            return { ...d, prayers };
          }),
        }));
        return on;
      },

      saveCheckin: (key, c) => set((s) => ({ days: withDay(s.days, key, (d) => ({ ...d, checkin: { ...c, at: Date.now() } })) })),

      saveReview: (weekKey, r) => set((s) => ({ reviews: { ...s.reviews, [weekKey]: { ...r, at: Date.now() } } })),

      startFocus: (session) => set({ focus: session }),

      endFocus: (key, now = Date.now()) => {
        const session = get().focus;
        if (!session) return null;
        const minutes = Math.max(0, Math.round((Math.min(now, session.end) - session.start) / 60000));
        const area: AreaId = session.area;
        set((s) => ({
          focus: null,
          days: withDay(s.days, key, (d) => ({ ...d, focus: { ...d.focus, [area]: (d.focus[area] ?? 0) + minutes } })),
        }));
        return { minutes, session };
      },

      setDhikr: (d) => set((s) => ({ dhikr: { ...s.dhikr, ...d } })),

      resetAll: () => set(initialState()),
    }),
    {
      name: 'mizan.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ onboarded, settings, tasks, habits, people, days, reviews, focus, dhikr }) => ({
        onboarded,
        settings,
        tasks,
        habits,
        people,
        days,
        reviews,
        focus,
        dhikr,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } };
      },
    },
  ),
);

/** True once saved data has been read from the device, so screens never flash the wrong state. */
export function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
}
