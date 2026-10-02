import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { toast } from '@/components/toast';
import { IconButton, T } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import type { PersonStatus } from '@/lib/logic';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export function sinceLabel(s: PersonStatus) {
  if (s.since == null) return 'Not logged yet';
  if (s.since === 0) return 'Today';
  if (s.since === 1) return 'Yesterday';
  return `${s.since} days ago`;
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, '');

/** Opens the phone or WhatsApp and logs the contact, so staying close takes one tap. */
export async function reachOut(id: string, name: string, phone: string, via: 'call' | 'whatsapp') {
  const n = digits(phone);
  const url = via === 'call' ? `tel:${n}` : `https://wa.me/${n.replace(/^\+/, '')}`;
  try {
    await Linking.openURL(url);
    useStore.getState().logContact(id);
    toast(`Logged a check-in with ${name}.`);
  } catch {
    toast(via === 'call' ? 'This device can’t place calls.' : 'WhatsApp isn’t available here.');
  }
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const c = useTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${c.area.family}22` }]}>
      <T variant="small" color={c.area.family} style={{ fontWeight: '700', fontSize: size * 0.34 }}>
        {initials(name)}
      </T>
    </View>
  );
}

export function PersonRow({ status }: { status: PersonStatus }) {
  const c = useTheme();
  const logContact = useStore((s) => s.logContact);
  const { person } = status;
  const birthday = status.birthdayIn != null && status.birthdayIn <= 14;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/person', params: { id: person.id } })}
      accessibilityRole="button"
      accessibilityHint="Opens details"
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Avatar name={person.name} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading" numberOfLines={1}>
          {person.name}
          <T variant="small" color={c.muted}>{`  ${person.relation}`}</T>
        </T>
        <T variant="caption" color={status.due ? c.danger : c.muted}>
          {sinceLabel(status)} · every {person.everyDays === 1 ? 'day' : `${person.everyDays} days`}
          {birthday ? ` · birthday ${status.birthdayIn === 0 ? 'today' : `in ${status.birthdayIn}d`}` : ''}
        </T>
      </View>
      {person.phone ? (
        <IconButton icon="phone" label={`Call ${person.name}`} size={38} onPress={() => reachOut(person.id, person.name, person.phone, 'call')} />
      ) : null}
      <IconButton
        icon="check"
        label={`Log a check-in with ${person.name}`}
        size={38}
        filled={status.due}
        onPress={() => {
          logContact(person.id);
          haptic.success();
          toast(`Logged. ${person.name} will be glad you did.`);
        }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
