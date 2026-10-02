import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import type { DayContext } from '@/lib/day';
import { haptic } from '@/lib/haptics';
import { PRAYERS, PRAYER_NAMES, type PrayerTimes } from '@/lib/praytimes';
import { clockParts, countdown, relativeIn } from '@/lib/time';
import { useStore } from '@/store/store';
import { SKY, fonts, radius } from '@/theme';

export function skyFor(times: PrayerTimes | null, now: number): keyof typeof SKY {
  if (!times?.fajr || !times.sunrise || !times.asr || !times.maghrib || !times.isha) return 'day';
  if (now < times.fajr || now >= times.isha) return 'night';
  if (now < times.sunrise) return 'dawn';
  if (now < times.asr) return 'day';
  if (now < times.maghrib) return 'golden';
  return 'dusk';
}

/** Compact card: next prayer, a countdown, and one-tap logging for each prayer. */
export function PrayerCard({ day }: { day: DayContext }) {
  const rec = useStore((s) => s.days[day.today]);
  const togglePrayer = useStore((s) => s.togglePrayer);
  const { next, times } = day;
  if (!times || !next) return null;
  const at = clockParts(next.at, day.tz, day.h12);
  const soon = next.at - day.now < 3600000;

  return (
    <Pressable onPress={() => router.push('/prayers')} accessibilityRole="button" accessibilityHint="Opens prayer times and Qibla">
      <LinearGradient colors={SKY[skyFor(times, day.now)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.top}>
          <View style={{ gap: 2 }}>
            <Text style={styles.eyebrow}>{next.tomorrow ? 'Tomorrow' : 'Next prayer'}</Text>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{PRAYER_NAMES[next.id]}</Text>
              <Text style={styles.at}>
                {at.time}
                {at.period ? ` ${at.period}` : ''}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.count}>{soon ? countdown(next.at - day.now) : relativeIn(next.at - day.now)}</Text>
            <Text style={styles.hijri}>{day.hijri}</Text>
          </View>
        </View>
        <View style={styles.dots}>
          {PRAYERS.map((id) => {
            const t = times[id];
            const started = t != null && t <= day.now;
            const done = !!rec?.prayers[id];
            return (
              <Pressable
                key={id}
                disabled={!started}
                hitSlop={4}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done, disabled: !started }}
                accessibilityLabel={`${PRAYER_NAMES[id]} prayed`}
                onPress={() => {
                  const on = togglePrayer(day.today, id);
                  if (on) haptic.success();
                  else haptic.tap();
                }}
                style={[styles.dotWrap, !started && { opacity: 0.45 }]}>
                <View style={[styles.dot, done && styles.dotDone, day.current === id && !done && styles.dotNow]}>
                  {done ? <Icon name="check" size={13} color="#10162A" strokeWidth={3} /> : null}
                </View>
                <Text style={styles.dotLabel}>{PRAYER_NAMES[id]}</Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 18, gap: 16, overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  name: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  at: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  count: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hijri: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5 },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotWrap: { alignItems: 'center', gap: 5, minWidth: 48 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  dotNow: { borderColor: '#FFFFFF', borderWidth: 2.5 },
  dotLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '600' },
});
