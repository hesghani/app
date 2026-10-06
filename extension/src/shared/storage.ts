// Typed access to chrome.storage.local. Everything Loupe knows lives here, on
// the user's machine; nothing is sent to any server.

import { withDefaults, type Settings } from './settings';
import type { Template } from './learn';
import type { AccountFacts, CaptureLogEntry, ListingDraft, NicheResult, ProductData, SaleRow, StoredProduct, SyncDebug, SyncState } from './types';
import type { MarketplaceId } from './marketplaces';

export interface Meta {
  lastCaptureAt?: number;
  lastCaptureRows?: number;
  lastWatchRefresh?: number;
  installedAt?: number;
  demo?: boolean;
  /** How far back daily sales have been synced, and when the catalog was last read. */
  coverage?: { salesFrom?: string; salesTo?: string; catalogAt?: number };
  migratedToDb?: boolean;
  /** Marketplaces Loupe has sales for; a marketplace's first import never notifies. */
  knownMarkets?: string[];
  /** The time zone Merch's own pages use for days (detected); US Pacific if unknown. */
  reportZone?: string;
  /** Older history, kept as monthly totals: which marketplace-months are stored, and which years had sales. */
  history?: { months: Record<string, number>; years: Record<string, number[]>; scannedAt?: number; from?: string };
  /** Merch's own totals next to Loupe's, from the last sync. */
  verify?: { at: number; zone: string; ranges: Array<{ key: string; label: string; from: string; to: string; merch: number; loupe: number }> };
}

interface Schema {
  settings: Partial<Settings>;
  /** Legacy: sales lived here before moving to IndexedDB; migrated on startup. */
  sales: Record<string, SaleRow>;
  drafts: ListingDraft[];
  niches: NicheResult[];
  captureLog: CaptureLogEntry[];
  templates: Template[];
  syncState: SyncState;
  syncDebug: SyncDebug | null;
  account: AccountFacts | null;
  agentDismissed: string[];
  meta: Meta;
}

type Key = keyof Schema;

const EMPTY: { [K in Key]: Schema[K] } = {
  settings: {},
  sales: {},
  drafts: [],
  niches: [],
  captureLog: [],
  templates: [],
  syncState: { status: 'idle', mode: 'quick', phase: '' },
  syncDebug: null,
  account: null,
  agentDismissed: [],
  meta: {},
};

export async function get<K extends Key>(key: K): Promise<Schema[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as Schema[K] | undefined) ?? structuredClone(EMPTY[key]);
}

export async function set<K extends Key>(key: K, value: Schema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function update<K extends Key>(key: K, fn: (value: Schema[K]) => Schema[K]): Promise<Schema[K]> {
  const next = fn(await get(key));
  await set(key, next);
  return next;
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await get('settings'));
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await set('settings', next);
  return next;
}

// ---------- Products (one key per product so tabs don't overwrite each other) ----------

export function productKey(mp: MarketplaceId, asin: string): string {
  return `p:${mp}:${asin}`;
}

export async function getProduct(mp: MarketplaceId, asin: string): Promise<StoredProduct | null> {
  const key = productKey(mp, asin);
  const result = await chrome.storage.local.get(key);
  return (result[key] as StoredProduct | undefined) ?? null;
}

export async function getProducts(keys: string[]): Promise<Record<string, StoredProduct>> {
  if (!keys.length) return {};
  return (await chrome.storage.local.get(keys)) as Record<string, StoredProduct>;
}

export async function allProducts(): Promise<StoredProduct[]> {
  const everything = await chrome.storage.local.get(null);
  return Object.entries(everything)
    .filter(([k]) => k.startsWith('p:'))
    .map(([, v]) => v as StoredProduct);
}

const HISTORY_GAP = 6 * 3600_000;
const HISTORY_MAX = 400;

/** Appends a BSR point when the rank changed or the last point is older than six hours. */
export function withHistory(prev: StoredProduct | null, data: ProductData): StoredProduct {
  const history = [...(prev?.history ?? [])];
  const last = history[history.length - 1];
  if (data.bsr && (!last || data.fetchedAt - last[0] > HISTORY_GAP || last[1] !== data.bsr)) {
    if (last && data.fetchedAt - last[0] < HISTORY_GAP) history[history.length - 1] = [data.fetchedAt, data.bsr];
    else history.push([data.fetchedAt, data.bsr]);
  }
  return {
    ...data,
    history: history.slice(-HISTORY_MAX),
    tracked: prev?.tracked,
    trackedAt: prev?.trackedAt,
    note: prev?.note,
  };
}

export async function saveProduct(data: ProductData): Promise<StoredProduct> {
  const prev = await getProduct(data.marketplace, data.asin);
  const next = withHistory(prev, data);
  await chrome.storage.local.set({ [productKey(data.marketplace, data.asin)]: next });
  return next;
}

export async function setTracked(mp: MarketplaceId, asin: string, tracked: boolean, data?: ProductData): Promise<StoredProduct | null> {
  const prev = await getProduct(mp, asin);
  const base = prev ?? (data ? withHistory(null, data) : null);
  if (!base) return null;
  const next: StoredProduct = { ...base, tracked, trackedAt: tracked ? (base.trackedAt ?? Date.now()) : undefined };
  await chrome.storage.local.set({ [productKey(mp, asin)]: next });
  return next;
}

/** Drops cached products that are not tracked and were fetched more than `days` ago. */
export async function pruneProducts(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 86_400_000;
  const stale = (await allProducts())
    .filter((p) => !p.tracked && p.fetchedAt < cutoff)
    .map((p) => productKey(p.marketplace, p.asin));
  if (stale.length) await chrome.storage.local.remove(stale);
  return stale.length;
}

export function onStorageChange(keys: string[] | ((key: string) => boolean), fn: () => void): () => void {
  const match = typeof keys === 'function' ? keys : (k: string) => keys.includes(k);
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && Object.keys(changes).some(match)) fn();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Everything, for backup. */
export async function exportAll(): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(null);
}

export async function importAll(data: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.clear();
  await chrome.storage.local.set(data);
}
