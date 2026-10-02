import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { toast } from '@/components/toast';
import { Card, Chip, Field, SheetHeader, T } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { haptic } from '@/lib/haptics';
import { prayedCount, tasksForToday } from '@/lib/logic';
import { addDaysKey } from '@/lib/time';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

const MOODS = ['Rough', 'Low', 'Okay', 'Good', 'Great'];
const ENERGY = ['Drained', 'Tired', 'Steady', 'Strong', 'Charged'];

export default function Checkin() {
  const c = useTheme();
  const day = useDay(60000);
  const { rec, tasks, habits, settings } = useStore(useShallow((s) => ({ rec: s.days[day.today], tasks: s.tasks, habits: s.habits, settings: s.settings })));
  const saved = rec?.checkin;
  const [mood, setMood] = useState(saved?.mood ?? 0);
  const [energy, setEnergy] = useState(saved?.energy ?? 0);
  const [win, setWin] = useState(saved?.win ?? '');
  const [grateful, setGrateful] = useState(saved?.grateful ?? '');
  const [tomorrow, setTomorrow] = useState('');

  const todays = tasksForToday(tasks, day.today);
  const done = todays.filter((t) => t.done).length;
  const active = habits.filter((h) => !h.archived);
  const hits = active.filter((h) => (rec?.habits[h.id] ?? 0) >= h.target).length;
  const summary = [
    `${done}/${todays.length} tasks`,
    active.length ? `${hits}/${active.length} habits` : null,
    settings.prayerTimeline && settings.loc ? `${prayedCount(rec)}/5 prayers` : null,
  ].filter(Boolean);

  const save = () => {
    useStore.getState().saveCheckin(day.today, { mood, energy, win: win.trim(), grateful: grateful.trim() });
    if (tomorrow.trim()) useStore.getState().addTask({ title: tomorrow.trim(), area: 'work', date: addDaysKey(day.today, 1), time: null }, day.today);
    haptic.success();
    toast(tomorrow.trim() ? 'Saved, and tomorrow has a first step.' : 'Saved. Rest well.');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Close your day" action="Save" onAction={save} actionDisabled={!mood} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 4 }}>
            <T variant="label">Today</T>
            <T variant="title" style={{ fontSize: 24, lineHeight: 29 }}>
              {summary.join(' · ')}
            </T>
          </Card>

          <View style={styles.group}>
            <T variant="label">How was today?</T>
            <View style={styles.wrap}>
              {MOODS.map((m, i) => (
                <Chip key={m} label={m} selected={mood === i + 1} onPress={() => setMood(i + 1)} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <T variant="label">Energy</T>
            <View style={styles.wrap}>
              {ENERGY.map((m, i) => (
                <Chip key={m} label={m} selected={energy === i + 1} onPress={() => setEnergy(i + 1)} />
              ))}
            </View>
          </View>

          <Field label="One win" value={win} onChangeText={setWin} placeholder="Small counts." multiline style={styles.multi} />
          <Field label="Grateful for" value={grateful} onChangeText={setGrateful} placeholder="Be specific." multiline style={styles.multi} />
          <Field label="First thing tomorrow" value={tomorrow} onChangeText={setTomorrow} placeholder="Optional. Added to tomorrow’s plan." />

          <T variant="caption" style={{ textAlign: 'center' }}>
            “Hold yourselves to account before you are held to account.” ʿUmar ibn al-Khattab
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 22, paddingBottom: 60 },
  group: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multi: { minHeight: 70, textAlignVertical: 'top' },
});
