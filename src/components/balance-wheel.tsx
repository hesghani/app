import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { AREAS, type AreaId } from '@/lib/model';
import { AREA_META, useTheme } from '@/theme';

/**
 * Six spokes, one per life area, scored 0–10.
 * The filled shape is how you rated the week; the dots are where your time actually went.
 */
export function BalanceWheel({ scores, activity, size = 280 }: { scores: Record<AreaId, number> | null; activity: Record<AreaId, number>; size?: number }) {
  const c = useTheme();
  const pad = 46;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / AREAS.length;
  const pt = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(10, v)) / 10) * R;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const maxAct = Math.max(1, ...AREAS.map((a) => activity[a]));
  const actScore = (a: AreaId) => (activity[a] / maxAct) * 10;

  return (
    <Svg width={size} height={size} accessibilityLabel="Life balance wheel">
      {[2.5, 5, 7.5, 10].map((ring) => (
        <Polygon key={ring} points={AREAS.map((_, i) => pt(i, ring).join(',')).join(' ')} fill="none" stroke={c.line} strokeWidth={1} />
      ))}
      {AREAS.map((a, i) => {
        const [x, y] = pt(i, 10);
        return <Line key={a} x1={cx} y1={cy} x2={x} y2={y} stroke={c.line} strokeWidth={1} />;
      })}
      {scores ? (
        <Polygon
          points={AREAS.map((a, i) => pt(i, scores[a]).join(',')).join(' ')}
          fill={c.ink}
          fillOpacity={0.1}
          stroke={c.ink}
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      ) : null}
      {AREAS.filter((a) => activity[a] > 0).map((a) => {
        const i = AREAS.indexOf(a);
        const [x, y] = pt(i, actScore(a));
        return <Circle key={a} cx={x} cy={y} r={5} fill={c.area[a]} stroke={c.surface} strokeWidth={2} />;
      })}
      <G>
        {AREAS.map((a, i) => {
          const r = R + 24;
          const x = cx + r * Math.cos(angle(i));
          const y = cy + r * Math.sin(angle(i)) + 4;
          return (
            <SvgText key={a} x={x} y={y} fontSize={12} fontWeight="600" fill={c.area[a]} textAnchor="middle">
              {AREA_META[a].label}
            </SvgText>
          );
        })}
      </G>
    </Svg>
  );
}
