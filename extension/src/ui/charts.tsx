// Charts for the dashboard, following the house rules: one series per chart
// (no dual axes), thin columns with rounded data ends, hairline grids, a
// tooltip on every mark, keyboard access, and a table view.

import { useEffect, useRef, useState } from 'preact/hooks';

function niceStep(max: number, ticks = 4): number {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function useWidth<T extends HTMLElement>(): [preact.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry!.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** A column with a 4px rounded top and a square base on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

export function ColumnChart({ data, format, height = 220, ariaLabel }: {
  data: ColumnDatum[]; format: (n: number) => string; height?: number; ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const left = 52;
  const right = 8;
  const top = 10;
  const axis = 26;
  const plotW = width - left - right;
  const plotH = height - top - axis;
  const max = Math.max(0, ...data.map((d) => d.value));
  const step = niceStep(max || 1);
  const yMax = Math.max(step, Math.ceil((max || 1) / step) * step);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 72))));
  const current = active !== null ? data[active] : null;

  return (
    <div
      class="chart"
      ref={ref}
      tabIndex={0}
      role="figure"
      aria-label={`${ariaLabel}. Use the arrow keys to read values.`}
      onKeyDown={(e) => {
        if (!data.length) return;
        if (e.key === 'ArrowRight') setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
        else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? data.length) - 1));
        else if (e.key === 'Escape') setActive(null);
        else return;
        e.preventDefault();
      }}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g>
            <line class={t === 0 ? 'baseline' : 'grid'} x1={left} x2={width - right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text class="tick" x={left - 8} y={y(t)} dy="0.32em" text-anchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = left + i * band + (band - barW) / 2;
          const h = (d.value / yMax) * plotH;
          return (
            <g>
              <path class={`bar ${active !== null && active !== i ? 'dim' : ''}`} d={columnPath(x, y(d.value), barW, h)} />
              <rect class="hit" x={left + i * band} y={top} width={band} height={plotH} onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} />
              {i % labelEvery === 0 && (
                <text class="tick" x={left + i * band + band / 2} y={height - 8} text-anchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {current && active !== null && (
        <div class="chart-tip" style={{ left: `${Math.min(width - 70, Math.max(70, left + active * band + band / 2))}px`, top: `${y(current.value)}px` }}>
          <div class="v"><span class="key" />{format(current.value)}</div>
          <div class="k">{current.detail ?? current.label}</div>
        </div>
      )}
    </div>
  );
}

export interface BarItem { key: string; label: string; value: number; display: string; sub?: string }

/** Horizontal bars for a breakdown. One color: the categories are nominal. */
export function BarList({ items, empty = 'No data in this range' }: { items: BarItem[]; empty?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!items.length || max === 0) return <p class="muted small">{empty}</p>;
  return (
    <div class="barlist">
      {items.map((item) => (
        <div class="item" title={`${item.label}: ${item.display}${item.sub ? ` (${item.sub})` : ''}`}>
          <span class="ellipsis">{item.label}</span>
          <div class="track"><div class="fill" style={{ width: `${(item.value / max) * 100}%` }} /></div>
          <span class="val">{item.display}{item.sub && <small>{item.sub}</small>}</span>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div class="table-wrap" style={{ maxHeight: '320px', overflowY: 'auto' }}>
      <table class="table">
        <thead><tr>{columns.map((c, i) => <th class={i ? 'num' : ''}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr>{r.map((v, i) => <td class={i ? 'num' : ''}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
