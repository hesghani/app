import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { HabitChip } from '@/components/habit-chip';
import { Icon } from '@/components/icon';
import { Avatar, reachOut, sinceLabel } from '@/components/person-row';
import { PrayerCard } from '@/components/prayer-card';
import { TaskRow } from '@/components/task-row';
import { toast } from '@/components/toast';
import { Button, Card, Check, Divider, IconButton, Screen, Section, T } from '@/components/ui';
import { insightFor } from '@/data/insights';
import { useDay } from '@/hooks/use-day';
import { haptic } from '@/lib/haptics';
import { TOP_LIMIT, buildTimeline, familyStatus, habitStreak, tasksForToday, topThree } from '@/lib/logic';
import { PRAYER_NAMES } from '@/lib/praytimes';
import { clockParts, dayNumber, formatDate, formatHm, minutesOfDay } from '@/lib/time';
import { useStore } from '@/store/store';
import { AREA_META, radius, useTheme } from '@/theme';

const GREETING = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' };

export default function Today() {
  const c = useTheme();
  const day = useDay(15000);
  const { settings, tasks, habits, people, days, togglePrayer, logContact } = useStore(
    useShallow((s) => ({
      settings: s.settings,
      tasks: s.tasks,
      habits: s.habits,
      people: s.people,
      days: s.days,
      togglePrayer: s.togglePrayer,
      logContact: s.logContact,
    })),
  );

  const rec = days[day.today];
  const todays = tasksForToday(tasks, day.today);
  const top = topThree(tasks, day.today);
  const rest = todays.filter((t) => !top.includes(t));
  const withPrayers = settings.prayerTimeline && !!settings.loc;
  const timeline = buildTimeline(rest, day.times, day.today, day.tz, withPrayers);
  const anytime = rest.filter((t) => !t.time || t.date !== day.today).sort((a, b) => Number(a.done) - Number(b.done));
  const activeHabits = habits.filter((h) => !h.archived);
  const nudge = familyStatus(people, day.today, day.tz).find((s) => s.due);
  const insight = insightFor(dayNumber(day.ymd));
  const nowMin = minutesOfDay(day.now, day.tz);
  const nowIndex = timeline.findIndex((i) => i.minutes > nowMin);
  const evening = day.part === 'evening' || day.part === 'night';
  const doneCount = todays.filter((t) => t.done).length;

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="display" accessibilityRole="header" numberOfLines={2}>
            {GREETING[day.part]}
            {settings.name ? `, ${settings.name}` : ''}
          </T>
          <T variant="small" color={c.muted}>
            {formatDate(day.now, day.tz, { weekday: 'long', day: 'numeric', month: 'long' })}
            {todays.length ? ` · ${doneCount} of ${todays.length} done` : ''}
          </T>
        </View>
        <IconButton icon="plus" label="Add a task" filled size={44} onPress={() => router.push('/task')} />
      </View>

      {withPrayers ? <PrayerCard day={day} /> : null}

      {evening && !rec?.checkin ? (
        <Pressable onPress={() => router.push('/checkin')} accessibilityRole="button">
          <Card style={styles.closeDay}>
            <Icon name="moon" size={22} color={c.area.growth} />
            <View style={{ flex: 1 }}>
              <T variant="heading">Close your day</T>
              <T variant="small" color={c.muted}>
                Sixty seconds: mood, one win, one thing you’re grateful for.
              </T>
            </View>
            <Icon name="chevronRight" size={18} color={c.faint} />
          </Card>
        </Pressable>
      ) : null}

      <Section label={`Top ${TOP_LIMIT}`} action={top.length < TOP_LIMIT ? 'Add' : undefined} onAction={() => router.push({ pathname: '/task', params: { top: '1' } })}>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {top.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 ? <Divider /> : null}
              <TaskRow task={t} today={day.today} h12={day.h12} />
            </Fragment>
          ))}
          {top.length < TOP_LIMIT ? (
            <>
              {top.length ? <Divider /> : null}
              <Pressable
                onPress={() => router.push({ pathname: '/task', params: { top: '1' } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addSlot, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={[styles.slotDot, { borderColor: c.faint }]} />
                <T variant="body" color={c.faint}>
                  {top.length ? 'Add another priority' : 'What are the 3 things that would make today a win?'}
                </T>
              </Pressable>
            </>
          ) : null}
        </Card>
      </Section>

      {activeHabits.length ? (
        <Section label="Habits" action="Edit" onAction={() => router.push('/habits')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
            {activeHabits.map((h) => (
              <HabitChip key={h.id} habit={h} dayKey={day.today} streak={habitStreak(days, h, day.today)} />
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {nudge ? (
        <Card style={styles.nudge}>
          <Avatar name={nudge.person.name} size={46} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="heading" numberOfLines={1}>
              {nudge.since == null ? `Check in with ${nudge.person.name}` : `It’s been a while with ${nudge.person.name}`}
            </T>
            <T variant="small" color={c.muted}>
              {sinceLabel(nudge)} · you aim for every {nudge.person.everyDays === 1 ? 'day' : `${nudge.person.everyDays} days`}
            </T>
          </View>
          {nudge.person.phone ? (
            <IconButton icon="phone" label={`Call ${nudge.person.name}`} onPress={() => reachOut(nudge.person.id, nudge.person.name, nudge.person.phone, 'call')} />
          ) : null}
          <IconButton
            icon="check"
            filled
            label={`Log a check-in with ${nudge.person.name}`}
            onPress={() => {
              logContact(nudge.person.id);
              haptic.success();
              toast(`Logged. ${nudge.person.name} will be glad you did.`);
            }}
          />
        </Card>
      ) : null}

      <Section label="Your day" action="Plan" onAction={() => router.push('/plan')}>
        <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {timeline.length === 0 ? (
            <View style={styles.emptyDay}>
              <T variant="small" color={c.muted}>
                Nothing scheduled. Give a task a time and it lands here, between your prayers.
              </T>
            </View>
          ) : (
            timeline.map((item, i) => (
              <Fragment key={item.kind === 'prayer' ? item.id : item.task.id}>
                {i === nowIndex ? <NowLine label={clockParts(day.now, day.tz, day.h12).time} /> : i > 0 ? <Divider /> : null}
                <View style={styles.timelineRow}>
                  <T variant="caption" style={styles.timeCol} color={item.minutes < nowMin ? c.faint : c.muted}>
                    {item.kind === 'prayer' ? clockParts(item.at, day.tz, day.h12).time : formatHm(item.task.time!, day.h12).replace(/ [AP]M$/, '')}
                  </T>
                  {item.kind === 'prayer' ? (
                    <View style={[styles.prayerRow]}>
                      <Check
                        done={!!rec?.prayers[item.id]}
                        color={c.area.faith}
                        label={`${item.label} prayed`}
                        onPress={() => togglePrayer(day.today, item.id)}
                      />
                      <T variant="body" style={{ fontWeight: '600' }}>
                        {PRAYER_NAMES[item.id]}
                      </T>
                      {day.current === item.id ? (
                        <View style={[styles.nowPill, { backgroundColor: `${c.area.faith}22` }]}>
                          <T variant="caption" color={c.area.faith} style={{ fontWeight: '700' }}>
                            Now
                          </T>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}>
                      <TaskRow task={item.task} today={day.today} h12={day.h12} compact />
                    </View>
                  )}
                </View>
              </Fragment>
            ))
          )}
          {timeline.length > 0 && nowIndex === -1 ? <NowLine label={clockParts(day.now, day.tz, day.h12).time} /> : null}
        </Card>
      </Section>

      {anytime.length ? (
        <Section label="Anytime today">
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {anytime.map((t, i) => (
              <Fragment key={t.id}>
                {i > 0 ? <Divider /> : null}
                <TaskRow task={t} today={day.today} h12={day.h12} />
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}

      {!todays.length && !activeHabits.length ? (
        <Button label="Add your first task" icon="plus" onPress={() => router.push({ pathname: '/task', params: { top: '1' } })} />
      ) : null}

      <Card style={{ gap: 10 }}>
        <View style={styles.insightHead}>
          <View style={[styles.areaTag, { backgroundColor: `${c.area[insight.area]}1F` }]}>
            <Icon name={AREA_META[insight.area].icon} size={13} color={c.area[insight.area]} />
            <T variant="caption" color={c.area[insight.area]} style={{ fontWeight: '700' }}>
              {AREA_META[insight.area].label}
            </T>
          </View>
          <T variant="caption">Today’s idea</T>
        </View>
        <T variant="title" style={{ fontSize: 25, lineHeight: 30 }}>
          {insight.quote}
        </T>
        <T variant="caption">{insight.source}</T>
        <View style={[styles.tryToday, { backgroundColor: c.surface2 }]}>
          <T variant="label" color={c.text}>
            Try today
          </T>
          <T variant="small">{insight.action}</T>
        </View>
      </Card>
    </Screen>
  );
}

function NowLine({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View style={styles.nowLine} accessibilityLabel={`Now, ${label}`}>
      <T variant="caption" color={c.accent} style={[styles.timeCol, { fontWeight: '700' }]}>
        {label}
      </T>
      <View style={[styles.nowDot, { backgroundColor: c.accent }]} />
      <View style={{ flex: 1, height: 1.5, backgroundColor: c.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  closeDay: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  addSlot: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  slotDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed' },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyDay: { paddingVertical: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeCol: { width: 44, fontVariant: ['tabular-nums'] },
  prayerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  nowPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  nowLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  nowDot: { width: 8, height: 8, borderRadius: 4, marginRight: -10 },
  insightHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  tryToday: { borderRadius: radius.md, padding: 12, gap: 4, marginTop: 4 },
});
