import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PlacePicker } from '@/components/place-picker';
import { Button, Chip, Field, T } from '@/components/ui';
import { DEFAULT_PRESETS, HABIT_PRESETS } from '@/data/presets';
import { haptic } from '@/lib/haptics';
import { AREAS, type Place } from '@/lib/model';
import { notificationsAllowed } from '@/lib/notify';
import { useStore } from '@/store/store';
import { AREA_META, SKY, fonts, radius, useTheme, type IconName } from '@/theme';

const PILLARS: [IconName, string, string][] = [
  ['sun', 'Plan around what matters', 'Your top three and a day built around prayer times.'],
  ['users', 'Stay close to family', 'Gentle nudges when it’s been too long, calls in one tap.'],
  ['flame', 'Habits across your life', 'Health, growth, faith and money, a few minutes a day.'],
  ['target', 'Focus, then reflect', 'Deep work blocks and a sixty-second evening check-in.'],
];

export default function Onboarding() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [picked, setPicked] = useState<string[]>(DEFAULT_PRESETS);

  const finish = async () => {
    haptic.success();
    await notificationsAllowed(true);
    useStore.getState().completeOnboarding({
      name,
      loc: place,
      presets: HABIT_PRESETS.filter((p) => picked.includes(p.title)),
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i <= step ? c.ink : c.line }]} />
          ))}
        </View>

        {step === 0 ? (
          <>
            <LinearGradient colors={SKY.dusk} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <Text style={styles.wordmark}>Mizan</Text>
              <Text style={styles.arabic}>‪ميزان‬ means balance</Text>
              <Text style={styles.headline}>Your work, family, faith and self, in balance.</Text>
            </LinearGradient>
            <View style={{ gap: 16 }}>
              {PILLARS.map(([icon, title, body]) => (
                <View key={title} style={styles.pillar}>
                  <View style={[styles.pillarIcon, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Icon name={icon} size={20} color={c.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="heading">{title}</T>
                    <T variant="small" color={c.muted}>
                      {body}
                    </T>
                  </View>
                </View>
              ))}
            </View>
            <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="Your first name" returnKeyType="next" onSubmitEditing={() => setStep(1)} />
            <Button label="Continue" icon="arrowRight" onPress={() => setStep(1)} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={{ gap: 8 }}>
              <T variant="display">Where are you?</T>
              <T variant="body" color={c.muted}>
                For prayer times on your timeline and the Qibla. It stays on your phone.
              </T>
            </View>
            {place ? (
              <View style={[styles.chosen, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="check" size={20} color={c.success} />
                <T variant="heading" style={{ flex: 1 }}>
                  {place.name}
                  {place.country ? `, ${place.country}` : ''}
                </T>
                <Button label="Change" small variant="ghost" onPress={() => setPlace(null)} />
              </View>
            ) : (
              <PlacePicker onPick={setPlace} />
            )}
            <Button label={place ? 'Continue' : 'Skip for now'} variant={place ? 'primary' : 'secondary'} onPress={() => setStep(2)} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={{ gap: 8 }}>
              <T variant="display">Pick a few habits</T>
              <T variant="body" color={c.muted}>
                Start small. Three or four is plenty; you can change them any time.
              </T>
            </View>
            {AREAS.map((a) => {
              const options = HABIT_PRESETS.filter((p) => p.area === a);
              if (!options.length) return null;
              return (
                <View key={a} style={{ gap: 10 }}>
                  <T variant="label" color={c.area[a]}>
                    {AREA_META[a].label}
                  </T>
                  <View style={styles.wrap}>
                    {options.map((p) => {
                      const on = picked.includes(p.title);
                      return (
                        <Chip
                          key={p.title}
                          label={p.target > 1 ? `${p.title} · ${p.target} ${p.unit}` : p.title}
                          color={c.area[a]}
                          selected={on}
                          onPress={() => setPicked((list) => (on ? list.filter((t) => t !== p.title) : [...list, p.title]))}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
            <Button label={picked.length ? `Start with ${picked.length} habit${picked.length === 1 ? '' : 's'}` : 'Start without habits'} icon="check" onPress={finish} />
            <Button label="Back" variant="ghost" onPress={() => setStep(1)} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  hero: { borderRadius: radius.xl, padding: 24, gap: 6, minHeight: 220, justifyContent: 'flex-end' },
  wordmark: { color: '#FFFFFF', fontFamily: fonts.displayItalic, fontSize: 30 },
  arabic: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'left', writingDirection: 'ltr' },
  headline: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 40, lineHeight: 44, marginTop: 18 },
  pillar: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pillarIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
