import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useTheme } from '@/theme';

const useToastStore = create<{ message: string | null; key: number }>(() => ({ message: null, key: 0 }));

export const toast = (message: string) => useToastStore.setState((s) => ({ message, key: s.key + 1 }));

export function ToastHost() {
  const { message, key } = useToastStore();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) useToastStore.setState({ message: null });
    });
  }, [key, message, opacity]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { top: insets.top + 8, opacity, backgroundColor: c.ink }]}>
      <Text style={[styles.text, { color: c.onInk }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    zIndex: 100,
    elevation: 6,
  },
  text: { fontSize: 14.5, fontWeight: '600', textAlign: 'center' },
});
