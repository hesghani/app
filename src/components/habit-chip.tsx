import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Ring, T } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import type { Habit } from '@/lib/model';
import { useStore } from '@/store/store';
import { radius, useTheme } from '@/theme';

/** Tap to count, long-press to undo. Fills its ring as it gets closer to the day's target. */
export function HabitChip({ habit, dayKey, streak }: { habit: Habit; dayKey: string; streak: number }) {
  const c = useTheme();
  const count = useStore((s) => s.days[dayKey]?.habits[habit.id] ?? 0);
  const bump = useStore((s) => s.bumpHabit);
  const done = count >= habit.target;
  const color = c.area[habit.area];
  const progress = `${count}/${habit.target}${habit.unit ? ` ${habit.unit}` : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}, ${progress}${done ? ', done' : ''}`}
      accessibilityHint="Tap to add one, long-press to remove one"
      onPress={() => {
        const next = bump(dayKey, habit.id, 1);
        if (next === habit.target) haptic.success();
        else haptic.tap();
      }}
      onLongPress={() => {
        bump(dayKey, habit.id, -1);
        haptic.warn();
      }}
      style={({ pressed }) => [styles.chip, { backgroundColor: c.surface, borderColor: done ? color : c.line, opacity: pressed ? 0.75 : 1 }]}>
      <View style={styles.ring}>
        <Ring size={40} stroke={4} progress={count / habit.target} color={color} track={c.surface2} />
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            {done ? <Icon name="check" size={16} color={color} strokeWidth={2.6} /> : <T variant="caption" color={c.muted} style={{ fontWeight: '700' }}>{count}</T>}
          </View>
        </View>
      </View>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <T variant="small" numberOfLines={2} style={{ fontWeight: '600' }}>
          {habit.title}
        </T>
        <T variant="caption">{streak > 1 ? `${progress} · ${streak}d streak` : progress}</T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 196,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  ring: { width: 40, height: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
