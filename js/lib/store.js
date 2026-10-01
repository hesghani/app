// Everything lives in this browser. No account, no server.

const KEY = 'ihsan.v1';

export function defaults() {
  return {
    v: 1,
    settings: {
      loc: null, // { name, country, lat, lng, tz }
      method: 'auto',
      asr: 'auto',
      clock: 'auto',
      theme: 'system',
      hijriOffset: 0,
      alerts: false,
      goals: { quran: 4, dhikr: 100 },
    },
    days: {}, // 'YYYY-MM-DD' -> { p: {fajr: ts,...}, one: {text, done}, quran, dhikr, focus, note: {win, fix, thanks} }
    focus: null, // { start, end, label, until }
    dhikr: { sel: 'after-salah', step: 0, count: 0 },
  };
}

export function hydrate(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...raw.settings, goals: { ...base.settings.goals, ...raw.settings?.goals } },
    dhikr: { ...base.dhikr, ...raw.dhikr },
    days: raw.days && typeof raw.days === 'object' ? raw.days : {},
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return hydrate(JSON.parse(raw));
  } catch {
    // Private mode or blocked storage: run with defaults.
  }
  return defaults();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked. The app keeps working for this session.
  }
}

export function day(state, key) {
  const rec = (state.days[key] ??= { p: {} });
  rec.p ??= {};
  return rec;
}
