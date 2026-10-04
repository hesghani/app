// Isolated-world script on merch.amazon.com. Receives the JSON the dashboard
// loads (from main-world.ts), turns it into sales rows for the background
// worker, and adds a small dock with listing tools on the create page.

import { useEffect, useState } from 'preact/hooks';
import * as fmt from '../../shared/format';
import type { Message } from '../../shared/messages';
import { normalizePayload, payloadShape } from '../../shared/sales';
import type { Settings } from '../../shared/settings';
import { get, getSettings, onStorageChange } from '../../shared/storage';
import { scanText, type TermHit } from '../../shared/trademark';
import type { ListingDraft, ReplayTemplate } from '../../shared/types';
import { shiftDateParams } from '../../shared/replay';
import { Alert, Close, External, Logo, Refresh, Shield, Wand } from '../../ui/icons';
import { mount } from '../shared/mount';
import { Emitter, useEmitter } from '../shared/store';
import { BASE_CSS } from '../shared/styles';
import { bulletsToDescription, fillListing, findAndReplace, findListingFields, type ListingField } from './fields';

const DOCK_CSS = `
.dock { position: fixed; left: 16px; bottom: 16px; z-index: 2147483646; }
.fab {
  display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px 0 10px; border-radius: 999px;
  background: #12141a; color: #fff; border: 0; box-shadow: 0 8px 24px rgba(18,20,26,.22); font-weight: 600;
}
.fab .count { background: var(--critical); color: #fff; border-radius: 999px; font-size: 11px; padding: 1px 7px; }
.fab .ok { background: rgba(255,255,255,.14); border-radius: 999px; font-size: 11px; padding: 1px 7px; font-weight: 500; }
.card {
  width: 340px; max-height: calc(100vh - 32px); overflow: auto; background: var(--surface); border: 1px solid var(--line);
  border-radius: 14px; box-shadow: 0 16px 48px rgba(18,20,26,.18);
}
.head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line-2); }
.brandmark { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--brand); }
.body { padding: 12px; display: grid; gap: 14px; }
h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 650; }
.sync { display: flex; align-items: center; gap: 8px; }
.sync .grow { font-size: 12px; }
.field { display: grid; gap: 6px; }
input.text, select.text {
  height: 30px; border: 1px solid var(--line); border-radius: 7px; padding: 0 8px; font: inherit; font-size: 12px; width: 100%;
  background: var(--surface); color: var(--ink);
}
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.hits { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 12px; }
.hits li { display: flex; gap: 6px; align-items: flex-start; }
.hits svg { flex: none; margin-top: 1px; }
.okline { display: flex; gap: 6px; align-items: center; color: var(--good-ink); font-size: 12px; }
.note { font-size: 11px; color: var(--muted); }
`;

class MerchState extends Emitter {
  open = false;
  fields: ListingField[] = [];
  hits: TermHit[] = [];
  lastCaptureAt = 0;
  lastRows = 0;
  totalRows = 0;
  drafts: ListingDraft[] = [];
  message = '';
  settings!: Settings;

  scanFields() {
    const fields = findListingFields(document);
    const changed = fields.length !== this.fields.length || fields.some((f, i) => f.el !== this.fields[i]?.el);
    this.fields = fields;
    this.checkTrademarks();
    if (changed) this.emit();
  }

  checkTrademarks() {
    const values: Record<string, string> = {};
    for (const f of this.fields) {
      const value = f.el.value.trim();
      if (value) values[f.kind] = values[f.kind] ? `${values[f.kind]} \n ${value}` : value;
    }
    const hits = scanText(values, { custom: this.settings?.customTerms, ignore: this.settings?.ignoredTerms });
    if (hits.map((h) => h.term + h.field).join() !== this.hits.map((h) => h.term + h.field).join()) {
      this.hits = hits;
      this.emit();
    }
  }

  say(message: string) {
    this.message = message;
    this.emit();
    window.setTimeout(() => {
      if (this.message === message) {
        this.message = '';
        this.emit();
      }
    }, 3000);
  }
}

const state = new MerchState();

async function replay() {
  const templates = await get('replay');
  if (!templates.length) {
    state.say('Nothing to refresh yet. Open your sales report once so Loupe can learn it.');
    return;
  }
  const requests = templates
    .filter((t) => new URL(t.url).origin === location.origin)
    .map((t) => ({ url: shiftDateParams(t.url, t.capturedAt), headers: t.headers }));
  window.postMessage({ __loupe: 'replay', requests }, location.origin);
  state.say('Refreshing sales…');
}

function Dock() {
  useEmitter(state);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [draftId, setDraftId] = useState('');

  useEffect(() => {
    if (!draftId && state.drafts[0]) setDraftId(state.drafts[0].id);
  }, [state.drafts.length]);

  const listing = state.fields.length >= 2;
  const risky = state.hits.filter((h) => h.severity === 'high').length;

  if (!state.open) {
    return (
      <div class="lp dock">
        <button class="fab" onClick={() => { state.open = true; state.emit(); }} aria-label="Open Loupe">
          <Logo size={18} />
          Loupe
          {listing && state.hits.length > 0 && <span class="count">{state.hits.length}</span>}
          {listing && state.hits.length === 0 && <span class="ok">Listing OK</span>}
          {!listing && state.lastCaptureAt > 0 && <span class="ok">Synced {fmt.ago(state.lastCaptureAt)}</span>}
        </button>
      </div>
    );
  }

  return (
    <div class="lp dock">
      <div class="card" role="dialog" aria-label="Loupe">
        <div class="head">
          <span class="brandmark"><Logo size={18} /> Loupe</span>
          <span class="grow" />
          <button class="btn sm icon ghost" title="Open dashboard" onClick={() => void chrome.runtime.sendMessage({ type: 'open-dashboard' } satisfies Message)}>
            <External size={14} />
          </button>
          <button class="btn sm icon ghost" title="Close" onClick={() => { state.open = false; state.emit(); }}>
            <Close size={14} />
          </button>
        </div>
        <div class="body">
          <div>
            <h4>Sales sync</h4>
            <div class="sync">
              <span class="grow">
                {state.lastCaptureAt
                  ? <>Synced <b>{state.totalRows.toLocaleString()}</b> sales rows · {fmt.ago(state.lastCaptureAt)}</>
                  : <>Open your <b>sales report</b> (Analyze) and Loupe records it automatically.</>}
              </span>
              <button class="btn sm" onClick={() => void replay()} title="Re-load the sales reports Loupe has seen">
                <Refresh size={13} /> Refresh
              </button>
            </div>
          </div>

          {listing ? (
            <>
              <div class="field">
                <h4>Fill from a draft</h4>
                {state.drafts.length ? (
                  <div class="row">
                    <select class="text grow" value={draftId} onChange={(e) => setDraftId((e.target as HTMLSelectElement).value)} aria-label="Draft">
                      {state.drafts.map((d) => <option value={d.id}>{d.name || d.title || 'Untitled draft'}</option>)}
                    </select>
                    <button
                      class="btn sm primary"
                      onClick={() => {
                        const draft = state.drafts.find((d) => d.id === draftId);
                        if (!draft) return;
                        const n = fillListing(state.fields, draft);
                        state.checkTrademarks();
                        state.say(`Filled ${n} fields`);
                      }}
                    >
                      <Wand size={13} /> Fill
                    </button>
                  </div>
                ) : (
                  <div class="note">Write drafts in Loupe → Listings, then fill them here in one click.</div>
                )}
              </div>

              <div class="field">
                <h4>Edit</h4>
                <button
                  class="btn sm"
                  onClick={() => {
                    const n = bulletsToDescription(state.fields);
                    state.say(n ? 'Copied bullets into the description' : 'Add bullet points first');
                  }}
                >
                  Bullets → description
                </button>
                <div class="two">
                  <input class="text" placeholder="Find" value={find} onInput={(e) => setFind((e.target as HTMLInputElement).value)} aria-label="Find" />
                  <input class="text" placeholder="Replace with" value={replace} onInput={(e) => setReplace((e.target as HTMLInputElement).value)} aria-label="Replace with" />
                </div>
                <button
                  class="btn sm"
                  disabled={!find}
                  onClick={() => {
                    const n = findAndReplace(state.fields, find, replace);
                    state.checkTrademarks();
                    state.say(n ? `Replaced in ${n} fields` : `“${find}” not found`);
                  }}
                >
                  Replace in all fields
                </button>
              </div>

              <div>
                <h4>Trademark & policy check</h4>
                {state.hits.length ? (
                  <ul class="hits">
                    {state.hits.slice(0, 8).map((hit) => (
                      <li class={`sev-${hit.severity}`}>
                        <Alert size={14} />
                        <span><b>{hit.term}</b> in {hit.field}. <span class="muted">{hit.reason}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div class="okline"><Shield size={14} /> No famous marks or policy terms found.</div>
                )}
                {risky > 0 && <div class="note" style={{ marginTop: '6px' }}>Still check every phrase on USPTO before publishing.</div>}
              </div>
            </>
          ) : (
            <div class="note">Listing tools appear here when you create or edit a product.</div>
          )}
          {state.message && <div class="note" role="status"><b>{state.message}</b></div>}
        </div>
      </div>
    </div>
  );
}

function handleCapture(data: { url: string; method: string; status: number; body?: string; json?: unknown; headers?: Record<string, string> }) {
  let payload: unknown = data.json;
  if (payload === undefined && typeof data.body === 'string') {
    try {
      payload = JSON.parse(data.body);
    } catch {
      return;
    }
  }
  if (payload === undefined || data.status >= 400) return;
  const rows = normalizePayload(payload, data.url);
  const path = new URL(data.url).pathname;
  void chrome.runtime.sendMessage({
    type: 'capture:log',
    entry: { path, at: Date.now(), rows: rows.length, status: data.status, keys: payloadShape(payload) },
  } satisfies Message);
  if (!rows.length) return;
  void chrome.runtime.sendMessage({ type: 'sales:ingest', rows } satisfies Message);
  if (data.method === 'GET') {
    const template: ReplayTemplate = { url: data.url, headers: data.headers ?? {}, capturedAt: Date.now(), rows: rows.length };
    void chrome.runtime.sendMessage({ type: 'replay:save', template } satisfies Message);
  }
}

async function boot() {
  if (window.top !== window) return;
  // Listen before anything async, then tell the page script to flush what it buffered.
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if ((event.data as { __loupe?: string })?.__loupe === 'capture') handleCapture(event.data);
  });
  window.postMessage({ __loupe: 'ready' }, location.origin);

  state.settings = await getSettings();
  const [meta, sales, drafts] = await Promise.all([get('meta'), get('sales'), get('drafts')]);
  state.lastCaptureAt = meta.lastCaptureAt ?? 0;
  state.totalRows = Object.keys(sales).length;
  state.drafts = drafts;

  onStorageChange(['meta', 'sales', 'drafts', 'settings'], async () => {
    const [m, s, d] = await Promise.all([get('meta'), get('sales'), get('drafts')]);
    state.lastCaptureAt = m.lastCaptureAt ?? 0;
    state.totalRows = Object.keys(s).length;
    state.drafts = d;
    state.settings = await getSettings();
    state.emit();
  });

  chrome.runtime.onMessage.addListener((message: Message, _sender, respond) => {
    if (message.type === 'merch:replay') {
      void replay();
      respond({ ok: true });
    } else if (message.type === 'listing:fill') {
      state.scanFields();
      const filled = fillListing(state.fields, message.draft, message.overwrite);
      state.checkTrademarks();
      respond({ filled });
    }
    return false;
  });

  const host = document.createElement('loupe-dock');
  document.documentElement.appendChild(host);
  mount(host, BASE_CSS + DOCK_CSS, <Dock />);

  state.scanFields();
  let timer = 0;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(() => state.scanFields(), 500);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => state.checkTrademarks(), 400);
  }, true);
}

void boot();
