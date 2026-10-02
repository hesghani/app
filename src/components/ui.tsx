import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { haptic } from '@/lib/haptics';
import { AREAS, type AreaId } from '@/lib/model';
import { AREA_META, fonts, gutter, radius, useTheme, type IconName } from '@/theme';

// ---------- text ----------

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption' | 'label' | 'number';

export function T({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  const tone = color ?? (variant === 'caption' || variant === 'label' ? c.muted : c.text);
  return <Text {...rest} style={[type[variant], { color: tone }, style]} />;
}

const type = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 42, lineHeight: 46, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12.5, lineHeight: 17 },
  label: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  number: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});

// ---------- layout ----------

/** Scrolling tab screen with a large serif title. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  ...rest
}: ScrollViewProps & { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...rest}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120, paddingHorizontal: gutter, gap: 22 }}>
      {title ? (
        <View style={styles.screenHead}>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="display" accessibilityRole="header">
              {title}
            </T>
            {subtitle ? <T variant="small" color={c.muted}>{subtitle}</T> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

/** Header for modal screens: title plus close, with an optional primary action. */
export function SheetHeader({ title, action, onAction, actionDisabled }: { title: string; action?: string; onAction?: () => void; actionDisabled?: boolean }) {
  const c = useTheme();
  return (
    <View style={[styles.sheetHead, { borderBottomColor: c.line }]}>
      <IconButton icon="close" label="Close" onPress={() => router.back()} />
      <T variant="heading" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        {title}
      </T>
      {action ? (
        <Pressable
          onPress={onAction}
          disabled={actionDisabled}
          accessibilityRole="button"
          hitSlop={10}
          style={({ pressed }) => [styles.sheetAction, { opacity: actionDisabled ? 0.35 : pressed ? 0.6 : 1 }]}>
          <T variant="heading" color={c.accent}>
            {action}
          </T>
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

export function Section({ label, action, onAction, children, style }: { label: string; action?: string; onAction?: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[{ gap: 10 }, style]}>
      <View style={styles.sectionHead}>
        <T variant="label">{label}</T>
        {action ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
            <T variant="small" color={c.accent} style={{ fontWeight: '600' }}>
              {action}
            </T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const c = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, padded && { padding: 16 }, style]}>{children}</View>;
}

export const Divider = () => {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
};

// ---------- controls ----------

export function Button({
  label,
  icon,
  variant = 'primary',
  onPress,
  disabled,
  style,
  small,
}: {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.ink : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.onInk : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? c.line : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color, size = 40, filled }: { icon: IconName; label: string; onPress?: () => void; color?: string; size?: number; filled?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, backgroundColor: filled ? c.ink : c.surface, borderColor: c.line, opacity: pressed ? 0.6 : 1 },
      ]}>
      <Icon name={icon} size={size * 0.48} color={filled ? c.onInk : color ?? c.text} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color, icon }: { label: string; selected?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  const c = useTheme();
  const tint = color ?? c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? tint : c.line,
          backgroundColor: selected ? tint : c.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {icon ? <Icon name={icon} size={15} color={selected ? (color ? '#FFFFFF' : c.onInk) : tint} /> : null}
      <Text style={[styles.chipText, { color: selected ? (color ? '#FFFFFF' : c.onInk) : c.text }]}>{label}</Text>
    </Pressable>
  );
}

export function AreaPicker({ value, onChange }: { value: AreaId; onChange: (a: AreaId) => void }) {
  const c = useTheme();
  return (
    <View style={styles.wrapRow}>
      {AREAS.map((a) => (
        <Chip key={a} label={AREA_META[a].label} icon={AREA_META[a].icon} color={c.area[a]} selected={value === a} onPress={() => onChange(a)} />
      ))}
    </View>
  );
}

export function AreaDot({ area, size = 8 }: { area: AreaId; size?: number }) {
  const c = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.area[area] }} />;
}

export function Check({ done, color, onPress, label, size = 26 }: { done: boolean; color?: string; onPress: () => void; label: string; size?: number }) {
  const c = useTheme();
  const tint = color ?? c.ink;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        if (done) haptic.tap();
        else haptic.success();
        onPress();
      }}
      style={[styles.check, { width: size, height: size, borderRadius: size / 2, borderColor: done ? tint : c.faint, backgroundColor: done ? tint : 'transparent' }]}>
      {done ? <Icon name="check" size={size * 0.6} color={color ? '#FFFFFF' : c.onInk} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: [V, string][]; value: V; onChange: (v: V) => void }) {
  const c = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.surface2 }]} accessibilityRole="tablist">
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.select();
              onChange(v);
            }}
            style={[styles.segmentItem, on && { backgroundColor: c.dark ? c.line : c.surface, shadowOpacity: 0.08 }]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: on ? c.text : c.muted }} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, format }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }) {
  return (
    <View style={styles.stepper}>
      <IconButton icon="minus" label="Decrease" size={34} onPress={() => onChange(Math.max(min, value - step))} />
      <T variant="number" style={{ minWidth: 44, textAlign: 'center' }}>
        {format ? format(value) : value}
      </T>
      <IconButton icon="plus" label="Increase" size={34} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={c.faint}
        {...rest}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.line }, style]}
      />
    </View>
  );
}

export function Row({ children, style, onPress, ...rest }: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} {...rest} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Ring({ size, stroke, progress, color, track }: { size: number; stroke: number; progress: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={circ * (1 - p)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export function Empty({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  const c = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
      <Icon name={icon} size={28} color={c.faint} />
      <T variant="heading">{title}</T>
      <T variant="small" color={c.muted} style={{ textAlign: 'center', maxWidth: 280 }}>
        {body}
      </T>
      {action ? <Button label={action} small variant="secondary" onPress={onAction} style={{ marginTop: 6 }} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screenHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetAction: { minWidth: 40, alignItems: 'flex-end' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  check: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.75 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 2 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { fontSize: 16, paddingHorizontal: 14, paddingVertical: 13, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
