import type { Template } from './learn';
import type { AccountFacts, CaptureLogEntry, CatalogItem, ListingDraft, RangeTotal, SaleRow, SyncMode } from './types';

export type Message =
  | { type: 'open-dashboard'; hash?: string }
  | { type: 'sales:ingest'; rows: SaleRow[] }
  | { type: 'totals:ingest'; totals: RangeTotal[] }
  | { type: 'catalog:ingest'; items: CatalogItem[] }
  | { type: 'catalog:complete'; startedAt: number }
  | { type: 'account:merge'; account: AccountFacts }
  | { type: 'template:save'; template: Template }
  | { type: 'capture:log'; entry: CaptureLogEntry }
  | { type: 'sync:start'; mode: SyncMode; interactive: boolean }
  | { type: 'sync:stop' }
  | { type: 'zone:detected'; zone: string }
  | { type: 'listing:fill'; draft: ListingDraft; overwrite: boolean }
  | { type: 'watchlist:refresh'; keys?: string[] }
  | { type: 'settings:changed' }
  | { type: 'badge:refresh' };

export function send<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
