import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';
import { Alert, Arrow, Info } from './icons';

// ---------- Toasts ----------

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div class="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => <div class="toast" key={t.id}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ---------- Building blocks ----------

export function Card({ title, actions, children, class: cls, pad = true }: {
  title?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren; class?: string; pad?: boolean;
}) {
  return (
    <section class={`card ${cls ?? ''}`}>
      {(title || actions) && (
        <div class="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {actions && <div class="row right">{actions}</div>}
        </div>
      )}
      {pad ? <div class="card-body">{children}</div> : children}
    </section>
  );
}

export function StatTile({ label, value, delta, vs, upIsGood = true, hint }: {
  label: string; value: string; delta?: number | null; vs?: string; upIsGood?: boolean; hint?: string;
}) {
  let deltaEl: JSX.Element | null = null;
  if (delta !== undefined) {
    if (delta === null) deltaEl = <div class="delta"><span class="vs">No sales in {vs ?? 'the previous period'}</span></div>;
    else {
      const rounded = Math.round(delta * 100);
      const dir = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
      const good = dir === 'flat' ? '' : (dir === 'up') === upIsGood ? 'up' : 'down';
      deltaEl = (
        <div class={`delta ${good}`}>
          {dir !== 'flat' && <Arrow dir={dir === 'up' ? 'up' : 'down'} size={13} />}
          <span class="num">{dir === 'flat' ? 'No change' : `${rounded > 0 ? '+' : ''}${rounded}%`}</span>
          {vs && <span class="vs">vs {vs}</span>}
        </div>
      );
    }
  }
  return (
    <div class="card stat" title={hint}>
      <div class="label">{label}</div>
      <div class="value">{value}</div>
      {deltaEl}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ComponentChildren; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="icon">{icon}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'bad'; children: ComponentChildren }) {
  return (
    <div class={`notice ${kind}`} role={kind === 'info' ? 'note' : 'alert'}>
      {kind === 'info' ? <Info size={16} /> : <Alert size={16} />}
      <div>{children}</div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: {
  value: T; options: Array<[T, string]>; onChange: (value: T) => void; label: string;
}) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button type="button" aria-pressed={v === value ? 'true' : 'false'} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label class="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="col" style={{ gap: '1px' }}>
        <span style={{ fontWeight: 550 }}>{label}</span>
        {hint && <span class="hint">{hint}</span>}
      </span>
    </label>
  );
}

export function Counter({ length, min = 0, max }: { length: number; min?: number; max: number }) {
  const bad = length > max || (length > 0 && length < min);
  return <span class={`counter ${bad ? 'bad' : ''}`}>{length}/{max}{min && length > 0 && length < min ? ` · min ${min}` : ''}</span>;
}

export function NumberInput({ value, onChange, step = 1, min, max, class: cls, label }: {
  value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; class?: string; label?: string;
}) {
  return (
    <input
      class={`input num ${cls ?? ''}`}
      type="number"
      aria-label={label}
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      max={max}
      onInput={(e) => {
        const n = Number((e.target as HTMLInputElement).value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
