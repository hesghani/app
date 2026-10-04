import type { CaptureLogEntry, ListingDraft, ReplayTemplate, SaleRow } from './types';

export type Message =
  | { type: 'open-dashboard'; hash?: string }
  | { type: 'sales:ingest'; rows: SaleRow[] }
  | { type: 'capture:log'; entry: CaptureLogEntry }
  | { type: 'replay:save'; template: ReplayTemplate }
  | { type: 'merch:replay' }
  | { type: 'merch:refresh-all' }
  | { type: 'listing:fill'; draft: ListingDraft; overwrite: boolean }
  | { type: 'watchlist:refresh'; keys?: string[] }
  | { type: 'settings:changed' }
  | { type: 'badge:refresh' };

export function send<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
