import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { SheetHeader, T } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { KAABA, distanceKm, qiblaBearing } from '@/lib/praytimes';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

const SIZE = 280;

export default function Qibla() {
  const c = useTheme();
  const loc = useStore((s) => s.settings.loc);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasAligned = useRef(false);

  const webNote = Platform.OS === 'web' ? 'The compass works in the phone app. Line up N with true north here.' : null;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        sub = await Location.watchHeadingAsync((h) => {
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading(v);
        });
        if (!perm.granted) setError('Without location, the compass uses magnetic north (a few degrees off).');
      } catch {
        setError('No compass on this device. Line up N with true north instead.');
      }
    })();
    return () => sub?.remove();
  }, []);

  const bearing = loc ? qiblaBearing(loc.lat, loc.lng) : 0;
  const off = heading == null ? null : ((bearing - heading + 540) % 360) - 180;
  const aligned = off != null && Math.abs(off) < 4;
  useEffect(() => {
    if (aligned && !wasAligned.current) haptic.success();
    wasAligned.current = aligned;
  }, [aligned]);

  if (!loc) return null;
  const km = Math.round(distanceKm(loc.lat, loc.lng, KAABA.lat, KAABA.lng));
  const rot = heading == null ? 0 : -heading;

  const mid = SIZE / 2;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Qibla" />
      <View style={styles.body}>
        <View style={[styles.pointer, { borderTopColor: aligned ? c.area.faith : c.text }]} />
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: `${rot}deg` }] }}>
          <Circle cx={mid} cy={mid} r={mid - 6} fill={aligned ? `${c.area.faith}22` : c.surface} stroke={c.line} strokeWidth={1.5} />
          {Array.from({ length: 72 }, (_, i) => (
            <Line
              key={i}
              x1={mid}
              y1={i % 6 === 0 ? 14 : 18}
              x2={mid}
              y2={26}
              stroke={i % 6 === 0 ? c.text : c.faint}
              strokeWidth={i % 6 === 0 ? 1.6 : 1}
              transform={`rotate(${i * 5} ${mid} ${mid})`}
            />
          ))}
          {(['N', 'E', 'S', 'W'] as const).map((l, i) => (
            <SvgText key={l} x={mid} y={48} fontSize={15} fontWeight="700" fill={l === 'N' ? c.danger : c.muted} textAnchor="middle" transform={`rotate(${i * 90} ${mid} ${mid})`}>
              {l}
            </SvgText>
          ))}
          <G transform={`rotate(${bearing} ${mid} ${mid})`}>
            <Line x1={mid} y1={mid} x2={mid} y2={86} stroke={c.area.faith} strokeWidth={2.5} strokeDasharray="4 5" />
            <Rect x={mid - 13} y={56} width={26} height={26} rx={3} fill={c.text} />
            <Rect x={mid - 13} y={63} width={26} height={4} fill={c.area.money} />
          </G>
          <Circle cx={mid} cy={mid} r={5} fill={c.text} />
        </Svg>

        <T variant="display">{bearing.toFixed(1)}°</T>
        <T variant="body" color={c.muted}>
          from true north · {km.toLocaleString('en')} km to the Kaaba
        </T>
        <T variant="heading" color={aligned ? c.area.faith : c.text} style={{ minHeight: 24 }}>
          {off == null ? '' : aligned ? 'You are facing the Qibla' : `Turn ${off > 0 ? 'right' : 'left'} ${Math.round(Math.abs(off))}°`}
        </T>
        <T variant="small" color={c.muted} style={{ textAlign: 'center', maxWidth: 300 }}>
          {error ?? webNote ?? 'Hold your phone flat and away from metal. Turn until the Kaaba reaches the top marker.'}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', paddingTop: 36, gap: 10, paddingHorizontal: 20 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -6,
    zIndex: 1,
  },
});
