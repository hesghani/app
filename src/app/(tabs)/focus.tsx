import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Button, Card, Chip, Ring, Screen, Section, Segmented, T } from '@/components/ui';
import { useDay, useNow } from '@/hooks/use-day';
import { haptic } from '@/lib/haptics';
import { tasksForToday } from '@/lib/logic';
import { AREAS, type AreaId, type FocusSession } from '@/lib/model';
import { cancelFocusEnd, scheduleFocusEnd } from '@/lib/notify';
import { PRAYER_NAMES } from '@/lib/praytimes';
import { countdown, formatKey, minutesLabel, weekKeys } from '@/lib/time';
import { useStore } from '@/store/store';
import { AREA_META, fonts, useTheme } from '@/theme';

type Length = '25' | '50' | '90' | 'prayer';
const KEEP_AWAKE_TAG = 'focus';

const newSession = (ms: number, rest: Omit<FocusSession, 'start' | 'end'>): FocusSession => {
  const start = Date.now();
  return { start, end: start + ms, ...rest };
};

export default function Focus() {
  const c = useTheme();
  const day = useDay(15000);
  const { focus, tasks, days, settings } = useStore(useShallow((s) => ({ focus: s.focus, tasks: s.tasks, days: s.days, settings: s.settings })));
  const [done, setDone] = useState<{ minutes: number; session: FocusSession } | null>(null);

  const prayerAware = settings.prayerTimeline && !!day.next;
  const untilPrayer = prayerAware ? day.next!.at - day.now : Infinity;
  const [length, setLength] = useState<Length>('25');
  const [area, setArea] = useState<AreaId>('work');
  const [taskId, setTaskId] = useState<string | null>(null);
  const open = tasksForToday(tasks, day.today).filter((t) => !t.done);

  const plannedMs = length === 'prayer' ? untilPrayer : Number(length) * 60000;
  const capped = prayerAware && plannedMs >= untilPrayer;
  const blockMs = Math.min(plannedMs, untilPrayer);

  const finish = (reason: 'done' | 'stopped') => {
    const res = useStore.getState().endFocus(day.today);
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    if (reason === 'stopped') cancelFocusEnd();
    if (res) {
      setDone(res);
      haptic.success();
    }
  };

  const start = () => {
    if (blockMs < 60000) return;
    const task = open.find((t) => t.id === taskId);
    const session = newSession(blockMs, {
      label: task?.title ?? '',
      area: task?.area ?? area,
      taskId: task?.id ?? null,
      until: capped ? day.next!.id : null,
    });
    useStore.getState().startFocus(session);
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    scheduleFocusEnd(
      session.end,
      session.until ? `${PRAYER_NAMES[session.until]} is in` : 'Block complete',
      session.until ? 'Stop here. Pray, then come back for the next block.' : 'Nice work. Take a short break.',
    );
    setDone(null);
    haptic.firm();
  };

  const week = weekKeys(day.today);
  const byArea = Object.fromEntries(AREAS.map((a) => [a, week.reduce((t, k) => t + (days[k]?.focus[a] ?? 0), 0)])) as Record<AreaId, number>;
  const weekTotal = AREAS.reduce((t, a) => t + byArea[a], 0);
  const perDay = week.map((k) => AREAS.reduce((t, a) => t + (days[k]?.focus[a] ?? 0), 0));
  const maxDay = Math.max(60, ...perDay);

  return (
    <Screen title="Focus" subtitle="One task, no distractions. Blocks end when it’s time to pray.">
      {focus ? (
        <Running session={focus} onFinish={finish} />
      ) : done ? (
        <Card style={styles.doneCard}>
          <T variant="display" style={{ fontFamily: fonts.displayItalic }}>
            Alhamdulillah.
          </T>
          <T variant="heading">{minutesLabel(done.minutes)} of focused {AREA_META[done.session.area].label.toLowerCase()}.</T>
          <T variant="small" color={c.muted} style={{ textAlign: 'center' }}>
            {done.session.until ? `${PRAYER_NAMES[done.session.until]} is in. Pray, stretch, then start the next block.` : 'Take five minutes. Water, a walk, a breath.'}
          </T>
          {done.session.taskId && !tasks.find((t) => t.id === done.session.taskId)?.done ? (
            <Button
              label="Mark the task done"
              icon="check"
              onPress={() => {
                useStore.getState().toggleTask(done.session.taskId!);
                setDone(null);
              }}
            />
          ) : null}
          <Button label="New block" variant="secondary" onPress={() => setDone(null)} />
        </Card>
      ) : (
        <Card style={{ gap: 20 }}>
          <View style={styles.preview}>
            <Ring size={190} stroke={8} progress={0} color={c.area[area]} track={c.surface2} />
            <View style={StyleSheet.absoluteFill}>
              <View style={styles.center}>
                <T style={styles.bigTime}>{countdown(blockMs)}</T>
                <T variant="small" color={c.muted}>
                  {capped ? `until ${PRAYER_NAMES[day.next!.id]}` : 'deep work'}
                </T>
              </View>
            </View>
          </View>
          <Segmented<Length>
            value={length}
            onChange={setLength}
            options={[
              ['25', '25 min'],
              ['50', '50 min'],
              ['90', '90 min'],
              ...(prayerAware ? ([['prayer', `To ${PRAYER_NAMES[day.next!.id]}`]] as [Length, string][]) : []),
            ]}
          />
          {open.length ? (
            <View style={{ gap: 8 }}>
              <T variant="label">Working on</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip label="Nothing specific" selected={taskId == null} onPress={() => setTaskId(null)} />
                {open.map((t) => (
                  <Chip key={t.id} label={t.title.length > 28 ? `${t.title.slice(0, 27)}…` : t.title} color={c.area[t.area]} selected={taskId === t.id} onPress={() => setTaskId(t.id)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          {taskId == null ? (
            <View style={{ gap: 8 }}>
              <T variant="label">Counts towards</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {AREAS.map((a) => (
                  <Chip key={a} label={AREA_META[a].label} icon={AREA_META[a].icon} color={c.area[a]} selected={area === a} onPress={() => setArea(a)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          <Button label={blockMs < 60000 ? 'Pray first' : 'Start with Bismillah'} icon="play" onPress={start} disabled={blockMs < 60000} />
        </Card>
      )}

      <Section label={`This week · ${minutesLabel(weekTotal)}`}>
        <Card style={{ gap: 16 }}>
          <View style={styles.bars} accessibilityLabel={`Focus per day: ${perDay.map(minutesLabel).join(', ')}`}>
            {week.map((k, i) => (
              <View key={k} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={{
                      height: `${perDay[i] ? Math.max(6, (perDay[i] / maxDay) * 100) : 3}%`,
                      backgroundColor: k === day.today ? c.accent : perDay[i] ? c.text : c.surface2,
                      borderRadius: 6,
                      width: '100%',
                    }}
                  />
                </View>
                <T variant="caption" color={k === day.today ? c.text : c.muted} style={{ fontWeight: k === day.today ? '700' : '500' }}>
                  {formatKey(k, { weekday: 'narrow' })}
                </T>
              </View>
            ))}
          </View>
          {weekTotal ? (
            <View style={styles.legend}>
              {AREAS.filter((a) => byArea[a]).map((a) => (
                <View key={a} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: c.area[a] }]} />
                  <T variant="caption">
                    {AREA_META[a].label} {minutesLabel(byArea[a])}
                  </T>
                </View>
              ))}
            </View>
          ) : (
            <T variant="small" color={c.muted}>
              Your focused time shows here, split by part of life.
            </T>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

function Running({ session, onFinish }: { session: FocusSession; onFinish: (r: 'done' | 'stopped') => void }) {
  const c = useTheme();
  const now = useNow(1000);
  const finished = useRef(false);
  const left = session.end - now;

  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  }, []);
  useEffect(() => {
    if (left <= 0 && !finished.current) {
      finished.current = true;
      onFinish('done');
    }
  }, [left, onFinish]);

  const color = c.area[session.area];
  return (
    <Card style={{ gap: 18, alignItems: 'center', paddingVertical: 28 }}>
      <View style={styles.timer}>
        <Ring size={250} stroke={10} progress={(now - session.start) / (session.end - session.start)} color={color} track={c.surface2} />
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <T style={[styles.bigTime, { fontSize: 52, lineHeight: 58 }]} accessibilityRole="timer">
              {countdown(left)}
            </T>
            <T variant="small" color={c.muted}>
              {session.until ? `until ${PRAYER_NAMES[session.until]}` : `${AREA_META[session.area].label} block`}
            </T>
          </View>
        </View>
      </View>
      {session.label ? (
        <T variant="title" style={{ textAlign: 'center' }}>
          {session.label}
        </T>
      ) : null}
      <T variant="small" color={c.muted}>
        Phone face down. One tab. Go.
      </T>
      <Button label="End block" icon="stop" variant="secondary" onPress={() => onFinish('stopped')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  preview: { alignSelf: 'center', width: 190, height: 190 },
  timer: { width: 250, height: 250 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  bigTime: { fontSize: 40, lineHeight: 46, fontWeight: '300', fontVariant: ['tabular-nums'] },
  doneCard: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  bars: { flexDirection: 'row', gap: 8, height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', maxWidth: 30, justifyContent: 'flex-end' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
