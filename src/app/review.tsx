import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { Card, Field, SheetHeader, T } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { haptic } from '@/lib/haptics';
import { weekActivity } from '@/lib/logic';
import { AREAS, type AreaId } from '@/lib/model';
import { addDaysKey, weekKeys, weekStartKey } from '@/lib/time';
import { useStore } from '@/store/store';
import { AREA_META, useTheme } from '@/theme';

export default function WeeklyReview() {
  const c = useTheme();
  const day = useDay(60000);
  const { reviews, tasks, habits, days } = useStore(useShallow((s) => ({ reviews: s.reviews, tasks: s.tasks, habits: s.habits, days: s.days })));
  const weekStart = weekStartKey(day.today);
  const prior = reviews[weekStart] ?? reviews[addDaysKey(weekStart, -7)];
  const [scores, setScores] = useState<Record<AreaId, number>>(
    prior?.scores ?? (Object.fromEntries(AREAS.map((a) => [a, 5])) as Record<AreaId, number>),
  );
  const [focus, setFocus] = useState(reviews[weekStart]?.focus ?? '');
  const [note, setNote] = useState(reviews[weekStart]?.note ?? '');
  const activity = weekActivity(weekKeys(day.today), tasks, habits, days, day.tz);
  const lowest = [...AREAS].sort((a, b) => scores[a] - scores[b])[0];

  const save = () => {
    useStore.getState().saveReview(weekStart, { scores, focus: focus.trim(), note: note.trim() });
    haptic.success();
    toast('Review saved. See your balance on the Me tab.');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Weekly review" action="Save" onAction={save} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <T variant="small" color={c.muted}>
            Five minutes, once a week. Rate how each part of life is going, from 1 (neglected) to 10 (thriving). Be honest; nobody else sees this.
          </T>

          {AREAS.map((a) => (
            <Card key={a} style={{ gap: 12 }}>
              <View style={styles.areaHead}>
                <Icon name={AREA_META[a].icon} size={20} color={c.area[a]} />
                <View style={{ flex: 1 }}>
                  <T variant="heading">{AREA_META[a].label}</T>
                  <T variant="caption">{activity[a] ? `${activity[a]} things logged this week` : AREA_META[a].blurb}</T>
                </View>
                <T variant="title" color={c.area[a]}>
                  {scores[a]}
                </T>
              </View>
              <View style={styles.scale} accessibilityRole="adjustable" accessibilityLabel={`${AREA_META[a].label} score ${scores[a]} of 10`}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Pressable
                    key={n}
                    hitSlop={4}
                    onPress={() => {
                      haptic.select();
                      setScores((s) => ({ ...s, [a]: n }));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${n}`}
                    style={[styles.tick, { backgroundColor: n <= scores[a] ? c.area[a] : c.surface2 }]}
                  />
                ))}
              </View>
            </Card>
          ))}

          <Field
            label="Next week, I’ll focus on"
            value={focus}
            onChangeText={setFocus}
            placeholder={`One change for ${AREA_META[lowest].label.toLowerCase()}, your lowest score`}
          />
          <Field label="Notes" value={note} onChangeText={setNote} placeholder="What worked, what didn’t" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, paddingBottom: 60 },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scale: { flexDirection: 'row', gap: 5 },
  tick: { flex: 1, height: 26, borderRadius: 6 },
});
