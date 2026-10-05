// IndexedDB for the large data sets: daily sales, the product catalog and
// range totals. A big seller has tens of thousands of sales rows and
// thousands of products, which is too much to rewrite as one chrome.storage
// value on every sync. Only extension pages and the service worker can open
// this database; content scripts send their data to the background worker.
//
// Writers bump `dataVersion` in chrome.storage so every open page can react.

import type { CatalogItem, RangeTotal, SaleRow } from './types';

const NAME = 'loupe';
const VERSION = 1;

export type StoreName = 'sales' | 'catalog' | 'totals';
export type Keyed<T> = T & { key: string };

interface Records {
  sales: Keyed<SaleRow>;
  catalog: CatalogItem;
  totals: RangeTotal;
}

let opening: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sales')) {
        const sales = db.createObjectStore('sales', { keyPath: 'key' });
        sales.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('totals')) db.createObjectStore('totals', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<S extends StoreName>(store: S): Promise<Array<Records[S]>> {
  const db = await openDb();
  return request(db.transaction(store).objectStore(store).getAll()) as Promise<Array<Records[S]>>;
}

export async function count(store: StoreName): Promise<number> {
  const db = await openDb();
  return request(db.transaction(store).objectStore(store).count());
}

export async function getMany<S extends StoreName>(store: S, keys: string[]): Promise<Map<string, Records[S]>> {
  const db = await openDb();
  const os = db.transaction(store).objectStore(store);
  const found = new Map<string, Records[S]>();
  await Promise.all(
    keys.map(async (key) => {
      const value = (await request(os.get(key))) as Records[S] | undefined;
      if (value) found.set(key, value);
    }),
  );
  return found;
}

export async function putMany<S extends StoreName>(store: S, items: Array<Records[S]>): Promise<void> {
  if (!items.length) return;
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const item of items) os.put(item);
  await done(tx);
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await done(tx);
}

export async function salesBetween(from: string, to: string): Promise<Array<Keyed<SaleRow>>> {
  const db = await openDb();
  const index = db.transaction('sales').objectStore('sales').index('date');
  return request(index.getAll(IDBKeyRange.bound(from, to))) as Promise<Array<Keyed<SaleRow>>>;
}

/** Tells open pages that a store changed. */
export async function bump(...stores: StoreName[]): Promise<void> {
  const { dataVersion } = (await chrome.storage.local.get('dataVersion')) as { dataVersion?: Record<string, number> };
  const next = { ...(dataVersion ?? {}) };
  for (const s of stores) next[s] = (next[s] ?? 0) + 1;
  await chrome.storage.local.set({ dataVersion: next });
}
