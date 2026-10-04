// Loads everything the dashboard shows from chrome.storage and keeps it live.

import { useEffect, useState } from 'preact/hooks';
import { withDefaults, type Settings } from '../shared/settings';
import { onStorageChange, type Meta } from '../shared/storage';
import type { CaptureLogEntry, ListingDraft, NicheResult, ReplayTemplate, SaleRow, StoredProduct } from '../shared/types';

export interface Data {
  ready: boolean;
  settings: Settings;
  sales: SaleRow[];
  meta: Meta;
  products: StoredProduct[];
  drafts: ListingDraft[];
  niches: NicheResult[];
  captureLog: CaptureLogEntry[];
  replay: ReplayTemplate[];
}

async function load(): Promise<Omit<Data, 'ready'>> {
  // One read for everything; products are stored one key each ("p:US:B0…").
  const all = await chrome.storage.local.get(null);
  const pick = <T>(key: string, fallback: T): T => (all[key] as T | undefined) ?? fallback;
  return {
    settings: withDefaults(pick<Partial<Settings>>('settings', {})),
    sales: Object.values(pick<Record<string, SaleRow>>('sales', {})),
    meta: pick<Meta>('meta', {}),
    products: Object.entries(all).filter(([k]) => k.startsWith('p:')).map(([, v]) => v as StoredProduct),
    drafts: pick<ListingDraft[]>('drafts', []),
    niches: pick<NicheResult[]>('niches', []),
    captureLog: pick<CaptureLogEntry[]>('captureLog', []),
    replay: pick<ReplayTemplate[]>('replay', []),
  };
}

export function useData(): Data | null {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const refresh = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        void load().then((d) => alive && setData({ ...d, ready: true }));
      }, 60);
    };
    refresh();
    const off = onStorageChange(() => true, refresh);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return data;
}

/** Hash routes look like "#research?q=cat&mp=US". */
export interface Route { page: string; params: URLSearchParams }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [page, query] = raw.split('?');
  return { page: page || 'overview', params: new URLSearchParams(query ?? '') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(page: string, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  location.hash = `${page}${query}`;
}
