import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { DateChips, TimeChips } from '@/components/pickers';
import { toast } from '@/components/toast';
import { AreaPicker, Button, Field, SheetHeader, T } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { timesFor } from '@/lib/day';
import { haptic } from '@/lib/haptics';
import { TOP_LIMIT, topThree } from '@/lib/logic';
import type { AreaId } from '@/lib/model';
import { keyYmd } from '@/lib/time';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

export default function TaskEditor() {
  const c = useTheme();
  const day = useDay(60000);
  const params = useLocalSearchParams<{ id?: string; top?: string; someday?: string; date?: string; area?: AreaId }>();
  const existing = useStore((s) => s.tasks.find((t) => t.id === params.id));
  const settings = useStore((s) => s.settings);
  const tasks = useStore((s) => s.tasks);
  const { addTask, updateTask, deleteTask, setTop } = useStore.getState();

  const [title, setTitle] = useState(existing?.title ?? '');
  const [area, setArea] = useState<AreaId>(existing?.area ?? params.area ?? 'work');
  const [date, setDate] = useState<string | null>(existing ? existing.date : params.someday ? null : (params.date ?? day.today));
  const [time, setTime] = useState<string | null>(existing?.time ?? null);
  const [top, setTopLocal] = useState(existing?.top ?? params.top === '1');

  const topCount = topThree(tasks, day.today).filter((t) => t.id !== existing?.id).length;
  const canTop = date === day.today && (top || topCount < TOP_LIMIT);
  const times = date ? timesFor(keyYmd(date), settings) : null;

  const save = () => {
    const clean = title.trim();
    if (!clean) return;
    if (existing) {
      updateTask(existing.id, { title: clean, area, date, time: date ? time : null });
      if (existing.top !== (top && date === day.today)) setTop(existing.id, top && date === day.today, day.today);
    } else {
      addTask({ title: clean, area, date, time: date ? time : null, top: top && canTop }, day.today);
      if (top && !canTop && date === day.today) toast('Saved. Your top three was already full.');
    }
    haptic.success();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title={existing ? 'Edit task' : 'New task'} action="Save" onAction={save} actionDisabled={!title.trim()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Field
            autoFocus={!existing}
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            returnKeyType="done"
            onSubmitEditing={save}
            style={{ fontSize: 20, paddingVertical: 16 }}
            accessibilityLabel="Task title"
          />

          <View style={styles.group}>
            <T variant="label">Part of life</T>
            <AreaPicker value={area} onChange={setArea} />
          </View>

          <View style={styles.group}>
            <T variant="label">When</T>
            <DateChips value={date} onChange={setDate} today={day.today} />
          </View>

          {date ? (
            <View style={styles.group}>
              <T variant="label">Time</T>
              <TimeChips value={time} onChange={setTime} times={settings.prayerTimeline ? times : null} tz={day.tz} h12={day.h12} />
            </View>
          ) : null}

          {date === day.today ? (
            <View style={[styles.switchRow, { borderColor: c.line, backgroundColor: c.surface }]}>
              <View style={{ flex: 1 }}>
                <T variant="heading">Top three today</T>
                <T variant="small" color={c.muted}>
                  {canTop ? 'One of the three things that would make today a win.' : 'Your top three is full.'}
                </T>
              </View>
              <Switch value={top && canTop} onValueChange={setTopLocal} disabled={!canTop} accessibilityLabel="Top three today" />
            </View>
          ) : null}

          {existing ? (
            <Button
              label="Delete task"
              variant="danger"
              icon="trash"
              onPress={() => {
                deleteTask(existing.id);
                toast('Task deleted.');
                router.back();
              }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 24, paddingBottom: 60 },
  group: { gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
});
