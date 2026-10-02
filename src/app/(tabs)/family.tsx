import { router } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Icon } from '@/components/icon';
import { PersonRow } from '@/components/person-row';
import { Button, Card, Chip, Divider, IconButton, Screen, Section, T } from '@/components/ui';
import { DEFAULT_EVERY } from '@/data/presets';
import { useDay } from '@/hooks/use-day';
import { familyStatus } from '@/lib/logic';
import { formatKey, addDaysKey } from '@/lib/time';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

const STARTERS = ['Mother', 'Father', 'Spouse', 'Sibling', 'Grandparent', 'Friend'];

export default function Family() {
  const c = useTheme();
  const day = useDay(60000);
  const people = useStore(useShallow((s) => s.people));
  const list = familyStatus(people, day.today, day.tz);
  const due = list.filter((s) => s.due);
  const fine = list.filter((s) => !s.due);
  const birthdays = list.filter((s) => s.birthdayIn != null && s.birthdayIn <= 30).sort((a, b) => a.birthdayIn! - b.birthdayIn!);

  const add = (relation?: string) => router.push({ pathname: '/person', params: relation ? { relation } : {} });

  return (
    <Screen
      title="Family"
      subtitle="The people who matter most, kept close on purpose."
      right={people.length ? <IconButton icon="plus" label="Add someone" filled size={44} onPress={() => add()} /> : null}>
      {people.length === 0 ? (
        <Card style={{ gap: 14 }}>
          <Icon name="users" size={28} color={c.area.family} />
          <T variant="title">Who do you want to stay close to?</T>
          <T variant="small" color={c.muted}>
            Add your parents, spouse, siblings or a friend. Mizan reminds you when it’s been too long and puts a call one tap away.
          </T>
          <View style={styles.wrap}>
            {STARTERS.map((r) => (
              <Chip key={r} label={r} icon="plus" onPress={() => add(r)} />
            ))}
          </View>
        </Card>
      ) : null}

      {due.length ? (
        <Section label={`Reach out · ${due.length}`}>
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {due.map((s, i) => (
              <Fragment key={s.person.id}>
                {i > 0 ? <Divider /> : null}
                <PersonRow status={s} />
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : people.length ? (
        <Card style={styles.allGood}>
          <Icon name="heart" size={22} color={c.area.family} />
          <T variant="small" style={{ flex: 1 }}>
            You’re in touch with everyone on your list. Keep it up.
          </T>
        </Card>
      ) : null}

      {birthdays.length ? (
        <Section label="Birthdays coming up">
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {birthdays.map((s, i) => (
              <Fragment key={s.person.id}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.bday}>
                  <Icon name="gift" size={20} color={c.area.family} />
                  <T variant="body" style={{ flex: 1 }}>
                    {s.person.name}
                  </T>
                  <T variant="small" color={s.birthdayIn! <= 3 ? c.area.family : c.muted} style={{ fontWeight: '600' }}>
                    {s.birthdayIn === 0 ? 'Today' : s.birthdayIn === 1 ? 'Tomorrow' : formatKey(addDaysKey(day.today, s.birthdayIn!), { weekday: 'short', day: 'numeric', month: 'short' })}
                  </T>
                </View>
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}

      {fine.length ? (
        <Section label="In touch">
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {fine.map((s, i) => (
              <Fragment key={s.person.id}>
                {i > 0 ? <Divider /> : null}
                <PersonRow status={s} />
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}

      {people.length ? (
        <Button label="Add someone" icon="plus" variant="secondary" onPress={() => add()} />
      ) : null}

      <T variant="caption" style={{ textAlign: 'center' }}>
        Suggested rhythm: parents every {DEFAULT_EVERY.Mother}–{DEFAULT_EVERY.Father} days, siblings weekly, relatives monthly.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bday: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
});
