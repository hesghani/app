import { router } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { BalanceWheel } from '@/components/balance-wheel';
import { Icon } from '@/components/icon';
import { Button, Card, Divider, Row, Screen, Section, T } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { prayedCount, weekActivity } from '@/lib/logic';
import { AREAS } from '@/lib/model';
import { addDaysKey, formatKey, minutesLabel, todayKey, weekKeys, weekStartKey } from '@/lib/time';
import { useStore } from '@/store/store';
import { AREA_META, useTheme, type IconName } from '@/theme';

const MOOD = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

export default function Me() {
  const c = useTheme();
  const day = useDay(60000);
  const { settings, tasks, habits, days, reviews, people } = useStore(
    useShallow((s) => ({ settings: s.settings, tasks: s.tasks, habits: s.habits, days: s.days, reviews: s.reviews, people: s.people })),
  );

  const week = weekKeys(day.today);
  // Only count days since the person started using the app, so a mid-week start isn't punished.
  const firstKey = Object.keys(days).sort()[0] ?? day.today;
  const elapsed = week.filter((k) => k <= day.today && k >= firstKey);
  const weekStart = weekStartKey(day.today);
  const review = reviews[weekStart] ?? reviews[addDaysKey(weekStart, -7)] ?? null;
  const reviewedThisWeek = !!reviews[weekStart];
  const activity = weekActivity(week, tasks, habits, days, day.tz);
  const inWeek = new Set(week);

  const active = habits.filter((h) => !h.archived);
  const habitDays = elapsed.flatMap((k) => active.filter((h) => k >= todayKey(day.tz, h.createdAt)).map((h) => [k, h] as const));
  const habitHits = habitDays.filter(([k, h]) => (days[k]?.habits[h.id] ?? 0) >= h.target).length;
  const habitRate = habitDays.length ? Math.round((habitHits / habitDays.length) * 100) : null;
  const prayers = elapsed.reduce((t, k) => t + prayedCount(days[k]), 0);
  const focusMin = week.reduce((t, k) => t + AREAS.reduce((s, a) => s + (days[k]?.focus[a] ?? 0), 0), 0);
  const tasksDone = tasks.filter((t) => t.done && t.doneAt && inWeek.has(todayKey(day.tz, t.doneAt))).length;
  const contacted = people.filter((p) => p.lastContact && inWeek.has(todayKey(day.tz, p.lastContact))).length;

  const stats: [string, string, string][] = [
    ['Tasks done', String(tasksDone), 'this week'],
    ['Focused', minutesLabel(focusMin), 'this week'],
    ['Habits hit', habitRate == null ? '–' : `${habitRate}%`, `${habitHits} check-off${habitHits === 1 ? '' : 's'}`],
    settings.prayerTimeline && settings.loc ? ['Prayers', `${prayers}/${Math.max(1, elapsed.length) * 5}`, 'logged'] : ['Family', `${contacted}/${people.length}`, 'reached'],
  ];

  const last7 = Array.from({ length: 7 }, (_, i) => addDaysKey(day.today, i - 6));

  const tools: [IconName, string, string, () => void][] = [
    ['kaaba', 'Prayer times & Qibla', settings.loc ? settings.loc.name : 'Set your location', () => router.push('/prayers')],
    ['beads', 'Dhikr counter', 'Tap to count, with haptics', () => router.push('/dhikr')],
    ['flame', 'Habits', `${active.length} active`, () => router.push('/habits')],
    ['settings', 'Settings', 'Reminders, prayer method, data', () => router.push('/settings')],
  ];

  return (
    <Screen title={settings.name || 'You'} subtitle={`Week of ${formatKey(weekStart, { day: 'numeric', month: 'long' })}`}>
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <View style={styles.wheelHead}>
          <T variant="label">Life balance</T>
          {review ? <T variant="caption">{reviewedThisWeek ? 'Rated this week' : 'Rated last week'}</T> : null}
        </View>
        <BalanceWheel scores={review?.scores ?? null} activity={activity} />
        <T variant="caption" style={{ textAlign: 'center' }}>
          {review ? 'The shape is how you rated each area. The dots show where your time actually went.' : 'The dots show where your time went this week. Rate each area to see the gap.'}
        </T>
        <Button
          label={reviewedThisWeek ? 'Update weekly review' : 'Do your weekly review'}
          icon="chart"
          variant={reviewedThisWeek ? 'secondary' : 'primary'}
          onPress={() => router.push('/review')}
          style={{ alignSelf: 'stretch', marginTop: 8 }}
        />
      </Card>

      <View style={styles.grid}>
        {stats.map(([label, value, sub]) => (
          <Card key={label} style={styles.stat}>
            <T variant="label">{label}</T>
            <T variant="title" numberOfLines={1}>
              {value}
            </T>
            <T variant="caption">{sub}</T>
          </Card>
        ))}
      </View>

      <Section label="Mood · last 7 days" action="Check in" onAction={() => router.push('/checkin')}>
        <Card style={styles.moodRow}>
          {last7.map((k) => {
            const mood = days[k]?.checkin?.mood ?? 0;
            return (
              <View key={k} style={styles.moodCol} accessibilityLabel={`${formatKey(k)}: ${mood ? MOOD[mood] : 'no check-in'}`}>
                <View style={styles.moodTrack}>
                  <View
                    style={{
                      height: mood ? `${mood * 20}%` : 4,
                      width: '100%',
                      borderRadius: 6,
                      backgroundColor: mood ? (mood >= 4 ? c.area.health : mood === 3 ? c.area.money : c.area.family) : c.surface2,
                    }}
                  />
                </View>
                <T variant="caption" color={k === day.today ? c.text : c.muted}>
                  {formatKey(k, { weekday: 'narrow' })}
                </T>
              </View>
            );
          })}
        </Card>
      </Section>

      {review?.focus ? (
        <Card style={{ gap: 6 }}>
          <T variant="label">Your focus this week</T>
          <T variant="title" style={{ fontSize: 24, lineHeight: 29 }}>
            {review.focus}
          </T>
        </Card>
      ) : null}

      <Section label="Tools">
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {tools.map(([icon, label, sub, go], i) => (
            <Fragment key={label}>
              {i > 0 ? <Divider /> : null}
              <Row onPress={go} style={{ paddingVertical: 14 }} accessibilityRole="button">
                <Icon name={icon} size={22} color={c.text} />
                <View style={{ flex: 1 }}>
                  <T variant="body" style={{ fontWeight: '600' }}>
                    {label}
                  </T>
                  <T variant="caption">{sub}</T>
                </View>
                <Icon name="chevronRight" size={18} color={c.faint} />
              </Row>
            </Fragment>
          ))}
        </Card>
      </Section>

      <T variant="caption" style={{ textAlign: 'center' }}>
        {AREAS.map((a) => AREA_META[a].label).join(' · ')}
        {'\n'}Everything stays on this phone. No account, no tracking.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wheelHead: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 4 },
  moodRow: { flexDirection: 'row', gap: 8, height: 120 },
  moodCol: { flex: 1, alignItems: 'center', gap: 6 },
  moodTrack: { flex: 1, width: '100%', maxWidth: 28, justifyContent: 'flex-end' },
});
