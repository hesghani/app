import { useEffect, useState } from 'preact/hooks';
import { MARKETPLACE_IDS, MARKETPLACES, type Currency, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPE_IDS, PRODUCT_TYPES, type ProductType } from '../../shared/products';

/** useState that survives reloads (per-viewer convenience only). */
export function usePersistent<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`loupe:${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`loupe:${key}`, JSON.stringify(value));
    } catch {
      /* storage blocked */
    }
  }, [key, value]);
  return [value, setValue];
}

export function MarketplaceSelect({ value, onChange, all = false, label = 'Marketplace', small = false }: {
  value: MarketplaceId | 'ALL'; onChange: (v: MarketplaceId | 'ALL') => void; all?: boolean; label?: string; small?: boolean;
}) {
  return (
    <select class={`select ${small ? 'sm' : ''}`} aria-label={label} value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as MarketplaceId | 'ALL')}>
      {all && <option value="ALL">All marketplaces</option>}
      {MARKETPLACE_IDS.map((id) => <option value={id}>{MARKETPLACES[id].flag} {MARKETPLACES[id].name}</option>)}
    </select>
  );
}

export function ProductTypeSelect({ value, onChange, all = false, small = false }: {
  value: ProductType | 'ALL'; onChange: (v: ProductType | 'ALL') => void; all?: boolean; small?: boolean;
}) {
  return (
    <select class={`select ${small ? 'sm' : ''}`} aria-label="Product type" value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as ProductType | 'ALL')}>
      {all && <option value="ALL">All products</option>}
      {PRODUCT_TYPE_IDS.map((id) => <option value={id}>{PRODUCT_TYPES[id].label}</option>)}
    </select>
  );
}

export function CurrencySelect({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <select class="select" aria-label="Display currency" value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as Currency)}>
      {(['USD', 'EUR', 'GBP', 'JPY'] as Currency[]).map((c) => <option value={c}>{c}</option>)}
    </select>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: preact.ComponentChildren }) {
  return (
    <div class="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div class="row wrap right">{children}</div>}
    </div>
  );
}

export function amazonImage(url: string | null | undefined, size = 80): string | undefined {
  if (!url) return undefined;
  return url.replace(/\._[^.]+_\./, `._AC_SX${size}_.`);
}
