import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Ring, SheetHeader, T } from '@/components/ui';
import { DHIKR } from '@/data/presets';
import { haptic } from '@/lib/haptics';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

export default function Dhikr() {
  const c = useTheme();
  const { sel, count } = useStore((s) => s.dhikr);
  const setDhikr = useStore((s) => s.setDhikr);
  const item = DHIKR.find((d) => d.id === sel) ?? DHIKR[0];
  const done = count >= item.n;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Dhikr" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {DHIKR.map((d) => (
          <Chip key={d.id} label={d.tr} color={c.area.faith} selected={d.id === item.id} onPress={() => setDhikr({ sel: d.id, count: 0 })} />
        ))}
      </ScrollView>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Count ${item.tr}. ${count} of ${item.n}.`}
          onPress={() => {
            const next = count + 1;
            setDhikr({ count: next });
            if (next === item.n) haptic.success();
            else haptic.tap();
          }}
          style={({ pressed }) => [styles.tap, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <Ring size={290} stroke={7} progress={count / item.n} color={c.area.faith} track={c.surface2} />
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.center}>
              <T style={styles.arabic}>{item.ar}</T>
              <T style={styles.count} color={done ? c.area.faith : c.text}>
                {count}
              </T>
              <T variant="small" color={c.muted}>
                {done ? 'Complete. Keep going if you like.' : `of ${item.n}`}
              </T>
            </View>
          </View>
        </Pressable>
        <T variant="heading">{item.tr}</T>
        <T variant="small" color={c.muted}>
          {item.en}
        </T>
        <Button label="Reset" variant="ghost" small onPress={() => setDhikr({ count: 0 })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  body: { flex: 1, alignItems: 'center', gap: 8, paddingTop: 12 },
  tap: { width: 290, height: 290 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  arabic: { fontSize: 30, lineHeight: 48, writingDirection: 'rtl' },
  count: { fontSize: 64, lineHeight: 70, fontWeight: '300', fontVariant: ['tabular-nums'] },
});
