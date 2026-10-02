import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { AreaDot, Check, T } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { isOverdue } from '@/lib/logic';
import type { Task } from '@/lib/model';
import { formatHm, formatKey } from '@/lib/time';
import { useStore } from '@/store/store';
import { AREA_META, useTheme } from '@/theme';

export function TaskRow({ task, today, h12, showDate, compact }: { task: Task; today: string; h12: boolean; showDate?: boolean; compact?: boolean }) {
  const c = useTheme();
  const toggleTask = useStore((s) => s.toggleTask);
  const setTop = useStore((s) => s.setTop);
  const overdue = isOverdue(task, today);

  const meta = [
    AREA_META[task.area].label,
    task.time ? formatHm(task.time, h12) : null,
    showDate && task.date ? formatKey(task.date) : null,
    overdue && task.date ? `From ${formatKey(task.date, { weekday: 'short' })}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/task', params: { id: task.id } })}
      accessibilityRole="button"
      accessibilityHint="Opens the task"
      style={({ pressed }) => [styles.row, compact && { paddingVertical: 8 }, { opacity: pressed ? 0.7 : 1 }]}>
      <Check done={task.done} color={c.area[task.area]} label={`Complete ${task.title}`} onPress={() => toggleTask(task.id)} />
      <View style={styles.body}>
        <T
          variant="body"
          numberOfLines={2}
          color={task.done ? c.faint : c.text}
          style={task.done ? styles.done : undefined}>
          {task.title}
        </T>
        <View style={styles.meta}>
          <AreaDot area={task.area} size={7} />
          <T variant="caption" color={overdue ? c.danger : c.muted}>
            {meta.join(' · ')}
          </T>
        </View>
      </View>
      {!task.done ? (
        <Pressable
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={task.top ? 'Remove from top three' : 'Add to top three'}
          onPress={() => {
            const ok = setTop(task.id, !task.top, today);
            if (!ok) {
              haptic.warn();
              toast('Your top three is full. Finish or unstar one first.');
            } else haptic.select();
          }}>
          <Icon name={task.top ? 'starFill' : 'star'} size={20} color={task.top ? c.area.money : c.faint} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  done: { textDecorationLine: 'line-through' },
});
