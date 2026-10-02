import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, reachOut } from '@/components/person-row';
import { toast } from '@/components/toast';
import { Button, Chip, Field, SheetHeader, Stepper, T } from '@/components/ui';
import { DEFAULT_EVERY, RELATIONS } from '@/data/presets';
import { useDay } from '@/hooks/use-day';
import { haptic } from '@/lib/haptics';
import { daysSince } from '@/lib/logic';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export default function PersonEditor() {
  const c = useTheme();
  const day = useDay(60000);
  const params = useLocalSearchParams<{ id?: string; relation?: string }>();
  const existing = useStore((s) => s.people.find((p) => p.id === params.id));
  const { addPerson, updatePerson, deletePerson, logContact } = useStore.getState();

  const initialRelation = existing?.relation ?? params.relation ?? 'Mother';
  const [name, setName] = useState(existing?.name ?? (params.relation && ['Mother', 'Father'].includes(params.relation) ? (params.relation === 'Mother' ? 'Mom' : 'Dad') : ''));
  const [relation, setRelation] = useState(initialRelation);
  const [every, setEvery] = useState(existing?.everyDays ?? DEFAULT_EVERY[initialRelation] ?? 7);
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [bMonth, setBMonth] = useState<number | null>(existing?.birthday ? Number(existing.birthday.slice(0, 2)) : null);
  const [bDay, setBDay] = useState(existing?.birthday ? Number(existing.birthday.slice(3, 5)) : 1);

  const birthday = bMonth ? `${String(bMonth).padStart(2, '0')}-${String(Math.min(bDay, DAYS_IN[bMonth - 1])).padStart(2, '0')}` : null;
  const since = existing ? daysSince(existing.lastContact, day.today, day.tz) : null;

  const save = () => {
    const clean = name.trim();
    if (!clean) return;
    const data = { name: clean, relation, everyDays: every, phone: phone.trim(), birthday, notes: notes.trim() };
    if (existing) updatePerson(existing.id, data);
    else addPerson(data);
    haptic.success();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title={existing ? existing.name : 'Add someone'} action="Save" onAction={save} actionDisabled={!name.trim()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {existing ? (
            <View style={styles.hero}>
              <Avatar name={existing.name} size={64} />
              <T variant="small" color={c.muted}>
                {since == null ? 'No check-ins logged yet' : since === 0 ? 'Last check-in: today' : `Last check-in: ${since} day${since === 1 ? '' : 's'} ago`}
              </T>
              <View style={styles.actions}>
                {existing.phone ? (
                  <>
                    <Button small label="Call" icon="phone" onPress={() => reachOut(existing.id, existing.name, existing.phone, 'call')} />
                    <Button small label="WhatsApp" icon="message" variant="secondary" onPress={() => reachOut(existing.id, existing.name, existing.phone, 'whatsapp')} />
                  </>
                ) : null}
                <Button
                  small
                  label="Log check-in"
                  icon="check"
                  variant="secondary"
                  onPress={() => {
                    logContact(existing.id);
                    haptic.success();
                    toast(`Logged a check-in with ${existing.name}.`);
                  }}
                />
              </View>
            </View>
          ) : null}

          <Field label="Name" value={name} onChangeText={setName} placeholder="Mom, Ahmed, Aunt Sara…" autoFocus={!existing} />

          <View style={styles.group}>
            <T variant="label">Relationship</T>
            <View style={styles.wrap}>
              {RELATIONS.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  color={c.area.family}
                  selected={relation === r}
                  onPress={() => {
                    setRelation(r);
                    if (!existing) setEvery(DEFAULT_EVERY[r] ?? 7);
                  }}
                />
              ))}
            </View>
          </View>

          <View style={[styles.rowBox, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <T variant="heading">Check in every</T>
              <T variant="small" color={c.muted}>
                We nudge you when it’s been longer.
              </T>
            </View>
            <Stepper value={every} min={1} max={90} onChange={setEvery} format={(v) => (v === 1 ? 'day' : `${v} days`)} />
          </View>

          <Field label="Phone (for one-tap call and WhatsApp)" value={phone} onChangeText={setPhone} placeholder="+44 7700 900123" keyboardType="phone-pad" />

          <View style={styles.group}>
            <T variant="label">Birthday</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label="Not set" selected={bMonth == null} onPress={() => setBMonth(null)} />
              {MONTHS.map((m, i) => (
                <Chip key={m} label={m} selected={bMonth === i + 1} onPress={() => setBMonth(i + 1)} />
              ))}
            </ScrollView>
            {bMonth ? (
              <View style={styles.rowBox}>
                <T variant="small" color={c.muted} style={{ flex: 1 }}>
                  Day of the month
                </T>
                <Stepper value={Math.min(bDay, DAYS_IN[bMonth - 1])} min={1} max={DAYS_IN[bMonth - 1]} onChange={setBDay} />
              </View>
            ) : null}
          </View>

          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Gift ideas, what they’re going through, things to ask about"
            multiline
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />

          {existing ? (
            <Button
              label={`Remove ${existing.name}`}
              variant="danger"
              icon="trash"
              onPress={() => {
                deletePerson(existing.id);
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
  body: { padding: 20, gap: 22, paddingBottom: 60 },
  hero: { alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  group: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
});
