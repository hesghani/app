import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, useFonts } from '@expo-google-fonts/instrument-serif';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { ToastHost } from '@/components/toast';
import { configureNotifications, rescheduleAll } from '@/lib/notify';
import { useHydrated, useStore } from '@/store/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotifications();

/** Keeps scheduled reminders in step with settings, people and the passing days. */
function useReminderSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(() => rescheduleAll(useStore.getState()), 800);
    };
    run();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.settings !== prev.settings || s.people !== prev.people) run();
    });
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') run();
    });
    return () => {
      clearTimeout(timer);
      unsub();
      app.remove();
    };
  }, [enabled]);
}

const modal = { presentation: 'modal' as const };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic });
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.onboarded);
  const c = useTheme();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  useReminderSync(ready && onboarded);

  if (!ready) return null;

  const base = c.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.line, primary: c.accent },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="task" options={modal} />
          <Stack.Screen name="person" options={modal} />
          <Stack.Screen name="habits" options={modal} />
          <Stack.Screen name="checkin" options={modal} />
          <Stack.Screen name="review" options={modal} />
          <Stack.Screen name="prayers" options={modal} />
          <Stack.Screen name="qibla" options={modal} />
          <Stack.Screen name="dhikr" options={modal} />
          <Stack.Screen name="settings" options={modal} />
          <Stack.Screen name="location" options={modal} />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </ThemeProvider>
  );
}
