import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { AreaPicker, Button, Card, Chip, Field, IconButton, SheetHeader, Stepper, T } from '@/components/ui';
import { HABIT_PRESETS } from '@/data/presets';
import { useDay } from '@/hooks/use-day';
import { habitStreak } from '@/lib/logic';
import type { AreaId, Habit } from '@/lib/model';
import { useStore } from '@/store/store';
import { AREA_META, useTheme } from '@/theme';

export default function Habits() {
  const c = useTheme();
  const day = useDay(60000);
  const { habits, days } = useStore(useShallow((s) => ({ habits: s.habits, days: s.days })));
  const { addHabit, archiveHabit } = useStore.getState();
  const active = habits.filter((h) => !h.archived);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<AreaId>('health');
  const [target, setTarget] = useState(1);
  const [unit, setUnit] = useState('');

  const presets = HABIT_PRESETS.filter((p) => !active.some((h) => h.title === p.title));

  const create = () => {
    if (!title.trim()) return;
    addHabit({ title: title.trim(), area, target, unit: unit.trim() });
    setTitle('');
    setTarget(1);
    setUnit('');
    toast('Habit added.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Habits" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <T variant="small" color={c.muted}>
            Small, daily, across every part of life. Tap a habit on Today to count it; long-press to undo.
          </T>

          {active.map((h) =>
            editing === h.id ? (
              <EditHabit key={h.id} habit={h} onDone={() => setEditing(null)} />
            ) : (
              <Card key={h.id} style={styles.habitRow}>
                <Icon name={AREA_META[h.area].icon} size={20} color={c.area[h.area]} />
                <View style={{ flex: 1 }}>
                  <T variant="heading">{h.title}</T>
                  <T variant="caption">
                    {h.target}
                    {h.unit ? ` ${h.unit}` : h.target > 1 ? ' times' : ''} a day · {habitStreak(days, h, day.today)}-day streak
                  </T>
                </View>
                <IconButton icon="settings" label={`Edit ${h.title}`} size={36} onPress={() => setEditing(h.id)} />
                <IconButton
                  icon="trash"
                  label={`Remove ${h.title}`}
                  size={36}
                  onPress={() => {
                    archiveHabit(h.id);
                    toast(`${h.title} removed. Its history is kept.`);
                  }}
                />
              </Card>
            ),
          )}

          {presets.length ? (
            <View style={{ gap: 10 }}>
              <T variant="label">Quick add</T>
              <View style={styles.wrap}>
                {presets.map((p) => (
                  <Chip
                    key={p.title}
                    label={p.title}
                    icon="plus"
                    color={c.area[p.area]}
                    onPress={() => {
                      addHabit(p);
                      toast(`${p.title} added.`);
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Card style={{ gap: 16 }}>
            <T variant="heading">Your own habit</T>
            <Field value={title} onChangeText={setTitle} placeholder="e.g. Walk after Asr" />
            <AreaPicker value={area} onChange={setArea} />
            <View style={styles.row}>
              <T variant="small" color={c.muted} style={{ flex: 1 }}>
                Daily target
              </T>
              <Stepper value={target} min={1} max={100} onChange={setTarget} />
            </View>
            {target > 1 ? <Field value={unit} onChangeText={setUnit} placeholder="Unit, e.g. pages, glasses, minutes" /> : null}
            <Button label="Add habit" icon="plus" onPress={create} disabled={!title.trim()} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function EditHabit({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const [title, setTitle] = useState(habit.title);
  const [area, setArea] = useState(habit.area);
  const [target, setTarget] = useState(habit.target);
  const [unit, setUnit] = useState(habit.unit);
  const c = useTheme();
  return (
    <Card style={{ gap: 14 }}>
      <Field value={title} onChangeText={setTitle} />
      <AreaPicker value={area} onChange={setArea} />
      <View style={styles.row}>
        <T variant="small" color={c.muted} style={{ flex: 1 }}>
          Daily target
        </T>
        <Stepper value={target} min={1} max={100} onChange={setTarget} />
      </View>
      {target > 1 ? <Field value={unit} onChangeText={setUnit} placeholder="Unit" /> : null}
      <Button
        label="Save"
        small
        onPress={() => {
          useStore.getState().updateHabit(habit.id, { title: title.trim() || habit.title, area, target, unit: unit.trim() });
          onDone();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, paddingBottom: 60 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
