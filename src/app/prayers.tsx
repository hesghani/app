import { router } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { PrayerCard } from '@/components/prayer-card';
import { Button, Card, Check, Divider, Empty, Row, SheetHeader, T } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { resolvePrayerSettings } from '@/lib/day';
import { prayerStreak } from '@/lib/logic';
import { METHODS, PRAYERS, PRAYER_NAMES } from '@/lib/praytimes';
import { formatClock } from '@/lib/time';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

export default function Prayers() {
  const c = useTheme();
  const day = useDay(30000);
  const { settings, days, togglePrayer } = useStore(useShallow((s) => ({ settings: s.settings, days: s.days, togglePrayer: s.togglePrayer })));
  const rec = days[day.today];
  const t = day.times;
  const { method, asr } = resolvePrayerSettings(settings);
  const clock = (ms: number | null) => formatClock(ms, day.tz, day.h12);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Prayer times" />
      <ScrollView contentContainerStyle={styles.body}>
        {!t ? (
          <Empty icon="locate" title="Set your location" body="Prayer times and the Qibla are calculated on your phone from where you are." action="Choose location" onAction={() => router.push('/location')} />
        ) : (
          <>
            <PrayerCard day={day} />
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {PRAYERS.map((id, i) => {
                const started = t[id] != null && t[id]! <= day.now;
                return (
                  <Fragment key={id}>
                    {i > 0 ? <Divider /> : null}
                    {id === 'dhuhr' ? (
                      <>
                        <Row style={styles.row}>
                          <View style={{ width: 26 }} />
                          <T variant="body" color={c.muted} style={{ flex: 1 }}>
                            Sunrise
                          </T>
                          <T variant="number" color={c.muted}>
                            {clock(t.sunrise)}
                          </T>
                        </Row>
                        <Divider />
                      </>
                    ) : null}
                    <Row style={styles.row}>
                      {started ? (
                        <Check done={!!rec?.prayers[id]} color={c.area.faith} label={`${PRAYER_NAMES[id]} prayed`} onPress={() => togglePrayer(day.today, id)} />
                      ) : (
                        <View style={[styles.pending, { borderColor: c.line }]} />
                      )}
                      <T variant="body" style={{ flex: 1, fontWeight: day.next?.id === id ? '700' : '500' }}>
                        {PRAYER_NAMES[id]}
                      </T>
                      <T variant="number">{clock(t[id])}</T>
                    </Row>
                  </Fragment>
                );
              })}
              <Divider />
              <Row style={styles.row}>
                <View style={{ width: 26 }} />
                <T variant="body" color={c.muted} style={{ flex: 1 }}>
                  Last third of the night
                </T>
                <T variant="number" color={c.muted}>
                  {clock(t.lastThird)}
                </T>
              </Row>
            </Card>

            <Card style={{ gap: 4 }}>
              <T variant="label">Streak</T>
              <T variant="title">{prayerStreak(days, day.today)} days with all five</T>
            </Card>

            <View style={styles.buttons}>
              <Button label="Qibla" icon="kaaba" onPress={() => router.push('/qibla')} style={{ flex: 1 }} />
              <Button label="Dhikr" icon="beads" variant="secondary" onPress={() => router.push('/dhikr')} style={{ flex: 1 }} />
            </View>

            <T variant="caption" style={{ textAlign: 'center' }}>
              {settings.loc?.name} · {METHODS[method].name} · {asr === 'hanafi' ? 'Hanafi' : 'Standard'} Asr{'\n'}
              Fajr at {METHODS[method].fajr}° below the horizon. Change it in Settings.
            </T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16, paddingBottom: 60 },
  row: { paddingVertical: 13 },
  pending: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
  buttons: { flexDirection: 'row', gap: 10 },
});
