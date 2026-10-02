import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { dayContext } from '@/lib/day';
import { useStore } from '@/store/store';

/** Current time, refreshed on an interval and whenever the app comes back to the foreground. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}

export function useDay(intervalMs = 30000) {
  const settings = useStore((s) => s.settings);
  const now = useNow(intervalMs);
  return useMemo(() => dayContext(settings, now), [settings, now]);
}
