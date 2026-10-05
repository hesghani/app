// Loads everything the dashboard shows and keeps it live: settings and small
// state from chrome.storage, sales/catalog/totals from IndexedDB.

import { useEffect, useState } from 'preact/hooks';
import { getAll } from '../shared/db';
import type { Template } from '../shared/learn';
import { withDefaults, type Settings } from '../shared/settings';
import type { Meta } from '../shared/storage';
import type { AccountFacts, CaptureLogEntry, CatalogItem, ListingDraft, NicheResult, RangeTotal, SaleRow, StoredProduct, SyncState } from '../shared/types';

export interface Data {
  ready: boolean;
  settings: Settings;
  sales: SaleRow[];
  catalog: CatalogItem[];
  totals: RangeTotal[];
  meta: Meta;
  products: StoredProduct[];
  drafts: ListingDraft[];
  niches: NicheResult[];
  captureLog: CaptureLogEntry[];
  templates: Template[];
  syncState: SyncState;
  account: AccountFacts | null;
  agentDismissed: string[];
  /** Bumps whenever sales, catalog or totals change, for memoization. */
  dbVersion: number;
}

type StoragePart = Omit<Data, 'ready' | 'sales' | 'catalog' | 'totals' | 'dbVersion'>;
type DbPart = Pick<Data, 'sales' | 'catalog' | 'totals'>;

async function loadStorage(): Promise<StoragePart> {
  const all = await chrome.storage.local.get(null);
  const pick = <T>(key: string, fallback: T): T => (all[key] as T | undefined) ?? fallback;
  return {
    settings: withDefaults(pick<Partial<Settings>>('settings', {})),
    meta: pick<Meta>('meta', {}),
    products: Object.entries(all).filter(([k]) => k.startsWith('p:')).map(([, v]) => v as StoredProduct),
    drafts: pick<ListingDraft[]>('drafts', []),
    niches: pick<NicheResult[]>('niches', []),
    captureLog: pick<CaptureLogEntry[]>('captureLog', []),
    templates: pick<Template[]>('templates', []),
    syncState: pick<SyncState>('syncState', { status: 'idle', mode: 'quick', phase: '' }),
    account: pick<AccountFacts | null>('account', null),
    agentDismissed: pick<string[]>('agentDismissed', []),
  };
}

async function loadDb(): Promise<DbPart> {
  const [sales, catalog, totals] = await Promise.all([getAll('sales'), getAll('catalog'), getAll('totals')]);
  return { sales, catalog, totals };
}

export function useData(): Data | null {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let alive = true;
    let storage: StoragePart | null = null;
    let db: DbPart | null = null;
    let version = 0;
    let timer = 0;
    let wantDb = true;
    const publish = () => {
      if (alive && storage && db) setData({ ...storage, ...db, ready: true, dbVersion: version });
    };
    const refresh = () => {
      clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const loadDbNow = wantDb;
        wantDb = false;
        const [s, d] = await Promise.all([loadStorage(), loadDbNow ? loadDb() : Promise.resolve(db)]);
        storage = s;
        if (loadDbNow) version += 1;
        db = d;
        publish();
      }, 80);
    };
    refresh();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if ('dataVersion' in changes) wantDb = true;
      refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(listener);
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
