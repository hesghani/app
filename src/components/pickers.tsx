import { StyleSheet, View } from 'react-native';

import { Chip, Stepper, T } from '@/components/ui';
import type { PrayerTimes } from '@/lib/praytimes';
import { PRAYERS, PRAYER_NAMES } from '@/lib/praytimes';
import { addDaysKey, formatHm, formatKey, hmToMinutes, minutesOfDay, minutesToHm } from '@/lib/time';
import { useTheme } from '@/theme';

export function DateChips({ value, onChange, today }: { value: string | null; onChange: (k: string | null) => void; today: string }) {
  const options: [string | null, string][] = [
    [today, 'Today'],
    [addDaysKey(today, 1), 'Tomorrow'],
    [addDaysKey(today, 2), formatKey(addDaysKey(today, 2), { weekday: 'long' })],
    [addDaysKey(today, 3), formatKey(addDaysKey(today, 3), { weekday: 'long' })],
    [addDaysKey(today, 7), 'In a week'],
    [null, 'Someday'],
  ];
  const custom = value != null && !options.some(([k]) => k === value);
  return (
    <View style={styles.wrap}>
      {custom ? <Chip label={formatKey(value!)} selected /> : null}
      {options.map(([k, label]) => (
        <Chip key={label} label={label} selected={value === k} onPress={() => onChange(k)} />
      ))}
    </View>
  );
}

/**
 * Times people actually plan by: "after Asr" as well as the clock.
 * Prayer options set the task 15 minutes after the prayer starts on that day.
 */
export function TimeChips({
  value,
  onChange,
  times,
  tz,
  h12,
}: {
  value: string | null;
  onChange: (hm: string | null) => void;
  times: PrayerTimes | null;
  tz: string;
  h12: boolean;
}) {
  const c = useTheme();
  const afterPrayer = times
    ? PRAYERS.filter((id) => times[id] != null).map((id) => [id, minutesToHm(minutesOfDay(times[id]!, tz) + 15)] as const)
    : [];
  const fixed: [string, string][] = [
    ['09:00', 'Morning'],
    ['13:00', 'Midday'],
    ['17:00', 'Evening'],
  ];
  const known = value == null || afterPrayer.some(([, hm]) => hm === value) || fixed.some(([hm]) => hm === value);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.wrap}>
        <Chip label="Any time" selected={value == null} onPress={() => onChange(null)} />
        {afterPrayer.map(([id, hm]) => (
          <Chip key={id} label={`After ${PRAYER_NAMES[id]}`} color={c.area.faith} selected={value === hm} onPress={() => onChange(hm)} />
        ))}
        {fixed.map(([hm, label]) => (
          <Chip key={hm} label={label} selected={value === hm} onPress={() => onChange(hm)} />
        ))}
        {!known ? <Chip label="Custom" selected /> : null}
      </View>
      {value != null ? (
        <View style={styles.custom}>
          <T variant="small" color={c.muted}>
            Exact time
          </T>
          <Stepper
            value={hmToMinutes(value)}
            min={0}
            max={23 * 60 + 45}
            step={15}
            onChange={(m) => onChange(minutesToHm(m))}
            format={(m) => formatHm(minutesToHm(m), h12)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  custom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
