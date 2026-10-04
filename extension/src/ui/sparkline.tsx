// BSR history line. Rank is plotted on an inverted log axis so that "up"
// means a better rank, which is how sellers read BSR.

import { useState } from 'preact/hooks';
import * as fmt from '../shared/format';

interface Props {
  points: Array<[number, number]>;
  width?: number;
  height?: number;
  color?: string;
}

export function BsrSparkline({ points, width = 320, height = 56, color = 'currentColor' }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const pad = 5;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => Math.log10(p[1]));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const best = Math.min(...ys);
  const worst = Math.max(...ys);
  const spanY = worst - best || 1;
  const sx = (t: number) => pad + ((t - x0) / (x1 - x0 || 1)) * (width - pad * 2);
  const sy = (y: number) => pad + ((y - best) / spanY) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(ys[i]!).toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  const active = hover !== null ? points[hover]! : last;
  const activeIndex = hover ?? points.length - 1;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        class="spark"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`BSR history: ${points.length} points, latest ${fmt.bsr(last[1])}`}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const t = x0 + ((e.clientX - rect.left) / rect.width) * (x1 - x0);
          let nearest = 0;
          points.forEach((p, i) => {
            if (Math.abs(p[0] - t) < Math.abs(points[nearest]![0] - t)) nearest = i;
          });
          setHover(nearest);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <path d={d} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={sx(active[0])} x2={sx(active[0])} y1={0} y2={height} stroke="#c3c2b7" stroke-width="1" vector-effect="non-scaling-stroke" />
        )}
        <circle cx={sx(active[0])} cy={sy(ys[activeIndex]!)} r="4" fill={color} stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" />
      </svg>
      <div class="note num" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{new Date(active[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>
          {fmt.bsr(active[1])} · best {fmt.bsr(10 ** best)}
        </span>
      </div>
    </div>
  );
}
