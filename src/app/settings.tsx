import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { Button, Card, Divider, Field, Row, Segmented, SheetHeader, Stepper, T } from '@/components/ui';
import { useDay } from '@/hooks/use-day';
import { resolvePrayerSettings } from '@/lib/day';
import { hijriFromYmd, hijriLabel } from '@/lib/hijri';
import { notificationsAllowed } from '@/lib/notify';
import { METHODS, type MethodId } from '@/lib/praytimes';
import { formatHm, hmToMinutes, minutesToHm } from '@/lib/time';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

export default function Settings() {
  const c = useTheme();
  const day = useDay(60000);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [showMethods, setShowMethods] = useState(false);
  const [armed, setArmed] = useState(false);
  const resolved = resolvePrayerSettings(settings);

  const toggleReminder = async (key: 'morningReminder' | 'eveningReminder', fallback: string) => {
    if (settings[key]) return update({ [key]: null });
    const ok = await notificationsAllowed(true);
    update({ [key]: fallback });
    if (!ok) toast('Saved. Turn on notifications for Mizan in your phone settings to get it.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Your name" value={settings.name} onChangeText={(name) => update({ name })} placeholder="Used in your greeting" />

        <T variant="label">Reminders</T>
        <Card padded={false} style={styles.group}>
          <ReminderRow
            title="Morning plan"
            sub="Top three, habits, who to call"
            value={settings.morningReminder}
            onToggle={() => toggleReminder('morningReminder', '07:30')}
            onChange={(v) => update({ morningReminder: v })}
            h12={day.h12}
          />
          <Divider />
          <ReminderRow
            title="Evening check-in"
            sub="Sixty seconds to close the day"
            value={settings.eveningReminder}
            onToggle={() => toggleReminder('eveningReminder', '21:30')}
            onChange={(v) => update({ eveningReminder: v })}
            h12={day.h12}
          />
        </Card>

        <T variant="label">Prayer</T>
        <Card padded={false} style={styles.group}>
          <Row onPress={() => router.push('/location')} style={styles.row} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <T variant="body" style={{ fontWeight: '600' }}>
                Location
              </T>
              <T variant="caption">{settings.loc ? `${settings.loc.name}${settings.loc.country ? `, ${settings.loc.country}` : ''}` : 'Not set'}</T>
            </View>
            <Icon name="chevronRight" size={18} color={c.faint} />
          </Row>
          <Divider />
          <SwitchRow title="Prayers on my timeline" sub="Plan your day around them and log each one" value={settings.prayerTimeline} onChange={(v) => update({ prayerTimeline: v })} />
          <Divider />
          <SwitchRow
            title="Prayer time alerts"
            sub="A notification when each prayer starts"
            value={settings.prayerAlerts}
            onChange={async (v) => {
              if (v && !(await notificationsAllowed(true))) toast('Turn on notifications for Mizan in your phone settings.');
              update({ prayerAlerts: v });
            }}
          />
          <Divider />
          <Row onPress={() => setShowMethods((s) => !s)} style={styles.row} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <T variant="body" style={{ fontWeight: '600' }}>
                Calculation method
              </T>
              <T variant="caption">
                {settings.method === 'auto' ? `Auto · ${METHODS[resolved.method].name}` : METHODS[resolved.method].name}
              </T>
            </View>
            <Icon name={showMethods ? 'chevronLeft' : 'chevronRight'} size={18} color={c.faint} />
          </Row>
          {showMethods ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {(['auto', ...Object.keys(METHODS)] as ('auto' | MethodId)[]).map((m) => (
                <Row key={m} onPress={() => update({ method: m })} style={{ paddingVertical: 10 }} accessibilityRole="radio" accessibilityState={{ selected: settings.method === m }}>
                  <T variant="small" style={{ flex: 1 }} color={settings.method === m ? c.text : c.muted}>
                    {m === 'auto' ? 'Auto (by region)' : `${METHODS[m].name} · Fajr ${METHODS[m].fajr}°`}
                  </T>
                  {settings.method === m ? <Icon name="check" size={18} color={c.accent} /> : null}
                </Row>
              ))}
            </View>
          ) : null}
          <Divider />
          <View style={styles.row}>
            <T variant="body" style={{ fontWeight: '600', flex: 1 }}>
              Asr
            </T>
            <View style={{ width: 200 }}>
              <Segmented
                value={resolved.asr}
                onChange={(asr) => update({ asr })}
                options={[
                  ['standard', 'Standard'],
                  ['hanafi', 'Hanafi'],
                ]}
              />
            </View>
          </View>
          <Divider />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T variant="body" style={{ fontWeight: '600' }}>
                Hijri date
              </T>
              <T variant="caption">{hijriLabel(hijriFromYmd(day.ymd, settings.hijriOffset))}</T>
            </View>
            <Stepper value={settings.hijriOffset} min={-2} max={2} onChange={(hijriOffset) => update({ hijriOffset })} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
          </View>
        </Card>

        <T variant="label">Display</T>
        <Card padded={false} style={styles.group}>
          <View style={styles.row}>
            <T variant="body" style={{ fontWeight: '600', flex: 1 }}>
              Clock
            </T>
            <View style={{ width: 200 }}>
              <Segmented
                value={settings.clock}
                onChange={(clock) => update({ clock })}
                options={[
                  ['auto', 'Auto'],
                  ['12', '12h'],
                  ['24', '24h'],
                ]}
              />
            </View>
          </View>
        </Card>

        <Button
          label={armed ? 'Tap again to erase everything' : 'Erase all data'}
          variant="danger"
          icon="trash"
          onPress={() => {
            if (!armed) {
              setArmed(true);
              setTimeout(() => setArmed(false), 4000);
              return;
            }
            useStore.getState().resetAll();
          }}
        />
        <T variant="caption" style={{ textAlign: 'center' }}>
          Mizan stores everything on this phone. No account, no servers, no tracking.
        </T>
      </ScrollView>
    </View>
  );
}

function SwitchRow({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <T variant="body" style={{ fontWeight: '600' }}>
          {title}
        </T>
        <T variant="caption">{sub}</T>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

function ReminderRow({
  title,
  sub,
  value,
  onToggle,
  onChange,
  h12,
}: {
  title: string;
  sub: string;
  value: string | null;
  onToggle: () => void;
  onChange: (v: string) => void;
  h12: boolean;
}) {
  return (
    <View>
      <SwitchRow title={title} sub={sub} value={value != null} onChange={onToggle} />
      {value ? (
        <View style={[styles.row, { paddingTop: 0 }]}>
          <T variant="small" style={{ flex: 1 }}>
            At
          </T>
          <Stepper value={hmToMinutes(value)} min={0} max={23 * 60 + 45} step={15} onChange={(m) => onChange(minutesToHm(m))} format={(m) => formatHm(minutesToHm(m), h12)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12, paddingBottom: 60 },
  group: { paddingVertical: 2, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
});
