// Isolated-world script on merch.amazon.com.
//  - Every frame: receives what Merch's pages load (from main-world.ts),
//    learns templates and sends sales, products and account facts to the
//    background worker, which runs syncs (background/sync.ts).
//  - Top frame: shows sync progress and adds the listing tools dock on the
//    create page.

import { useEffect, useState } from 'preact/hooks';
import * as fmt from '../../shared/format';
import { describeRequest, describeShape, learn, type Capture } from '../../shared/learn';
import type { Message } from '../../shared/messages';
import type { Settings } from '../../shared/settings';
import { get, getSettings, onStorageChange } from '../../shared/storage';
import { scanText, type TermHit } from '../../shared/trademark';
import type { ListingDraft, SyncState } from '../../shared/types';
import { Alert, Close, External, Logo, Refresh, Shield, Wand } from '../../ui/icons';
import { mount } from '../shared/mount';
import { Emitter, useEmitter } from '../shared/store';
import { BASE_CSS } from '../shared/styles';
import { bulletsToDescription, fillListing, findAndReplace, findListingFields, type ListingField } from './fields';

const isTop = window.top === window;
const send = (m: Message) => chrome.runtime.sendMessage(m).catch(() => undefined);

// ---------- capture ----------

interface RawCapture {
  url: string;
  method: string;
  status: number;
  body?: string;
  json?: unknown;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
}

function handleCapture(data: RawCapture) {
  let payload: unknown = data.json;
  if (payload === undefined && typeof data.body === 'string') {
    try {
      payload = JSON.parse(data.body);
    } catch {
      return;
    }
  }
  if (payload === undefined || data.status >= 400) return;
  const capture: Capture = {
    url: data.url, method: data.method, status: data.status, headers: data.reqHeaders ?? {}, body: data.reqBody, payload, at: Date.now(),
  };
  const learned = learn(capture);
  void send({
    type: 'capture:log',
    entry: {
      path: new URL(capture.url).pathname,
      at: capture.at,
      rows: learned.rows.length,
      items: learned.items.length,
      status: capture.status,
      kind: learned.kind,
      template: Boolean(learned.template),
      request: describeRequest(capture.method, capture.url, capture.body),
      keys: describeShape(payload, 40),
    },
  });
  if (learned.account) void send({ type: 'account:merge', account: learned.account });
  if (learned.rows.length) void send({ type: 'sales:ingest', rows: learned.rows });
  if (learned.items.length) void send({ type: 'catalog:ingest', items: learned.items });
  if (learned.template) void send({ type: 'template:save', template: learned.template });
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if ((event.data as { __loupe?: string })?.__loupe === 'capture') handleCapture(event.data as RawCapture);
});
window.postMessage({ __loupe: 'ready' }, location.origin);

// ---------- dock (top frame) ----------

const DOCK_CSS = `
.dock { position: fixed; left: 16px; bottom: 16px; z-index: 2147483646; }
.lp .fab {
  display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px 0 10px; border-radius: 999px;
  background: #12141a; color: #fff; border: 0; box-shadow: 0 8px 24px rgba(18,20,26,.22); font-weight: 600;
}
.lp .fab .count { background: var(--critical); color: #fff; border-radius: 999px; font-size: 11px; padding: 1px 7px; }
.lp .fab .ok { background: rgba(255,255,255,.14); border-radius: 999px; font-size: 11px; padding: 1px 7px; font-weight: 500; }
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
.banner {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; width: min(560px, calc(100vw - 24px));
  background: #12141a; color: #fff; border-radius: 12px; padding: 12px 14px; box-shadow: 0 16px 48px rgba(0,0,0,.3); display: grid; gap: 8px;
}
.banner .row { display: flex; align-items: center; gap: 10px; }
.banner .title { font-weight: 650; }
.banner .sub { font-size: 12px; color: #c3c6cf; }
.banner .bar { height: 4px; background: rgba(255,255,255,.15); border-radius: 999px; overflow: hidden; }
.banner .bar > div { height: 100%; background: #8b80ff; transition: width .3s; }
.banner .bar.indeterminate > div { width: 30%; animation: slide 1.2s ease-in-out infinite; }
@keyframes slide { from { margin-left: -30%; } to { margin-left: 100%; } }
.lp.banner .btn { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); color: #fff; }
.banner.done { background: #0f2a17; }
.banner.bad { background: #3a1416; }
`;

class MerchState extends Emitter {
  open = false;
  fields: ListingField[] = [];
  hits: TermHit[] = [];
  drafts: ListingDraft[] = [];
  message = '';
  sync: SyncState | null = null;
  lastSync = 0;
  bannerClosed = false;
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

function SyncBanner() {
  useEmitter(state);
  const s = state.sync;
  if (!s || state.bannerClosed) return null;
  const mine = s.tabId !== undefined && s.status !== 'idle';
  if (!mine || (s.status === 'running' && s.mode === 'quick')) return null;
  if (s.status !== 'running' && (s.finishedAt ?? 0) < Date.now() - 10 * 60_000) return null;
  const pct = s.progress && s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : null;
  const tone = s.status === 'done' ? 'done' : s.status === 'error' || s.status === 'signin' ? 'bad' : '';
  return (
    <div class={`lp banner ${tone}`} role="status" aria-live="polite">
      <div class="row">
        <Logo size={20} />
        <span class="title grow">
          {s.status === 'running' ? 'Loupe is syncing your Merch account' : s.status === 'done' ? 'Loupe is connected' : s.status === 'partial' ? 'Loupe is partly connected' : 'Loupe could not finish the sync'}
        </span>
        {s.status !== 'running' && (
          <>
            <button class="btn sm" onClick={() => void send({ type: 'open-dashboard', hash: s.status === 'done' ? 'agent' : 'settings?section=diagnostics' })}>
              {s.status === 'done' ? 'Open your agent' : 'Details'}
            </button>
            <button class="btn sm icon" title="Close" onClick={() => { state.bannerClosed = true; state.emit(); }}><Close size={13} /></button>
          </>
        )}
      </div>
      <div class="sub">
        {s.phase}
        {s.status === 'running' && pct !== null ? ` · ${pct}%` : ''}
        {s.status !== 'running' && s.stats ? ` · ${s.stats.salesRows.toLocaleString()} sales rows, ${s.stats.catalogItems.toLocaleString()} products` : ''}
      </div>
      {s.status === 'running' && (
        <div class={`bar ${pct === null ? 'indeterminate' : ''}`}><div style={pct === null ? undefined : { width: `${pct}%` }} /></div>
      )}
      {s.status === 'running' && (
        <div class="row">
          <span class="sub grow">Loupe works in the background. You can keep using Merch.</span>
          <button class="btn sm" onClick={() => void send({ type: 'sync:stop' })}>Stop</button>
        </div>
      )}
      {s.error && s.status !== 'running' && <div class="sub">{s.error}</div>}
    </div>
  );
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
  const syncing = state.sync?.status === 'running';

  if (!state.open) {
    return (
      <div class="lp dock">
        <button class="fab" onClick={() => { state.open = true; state.emit(); }} aria-label="Open Loupe">
          <Logo size={18} />
          Loupe
          {listing && state.hits.length > 0 && <span class="count">{state.hits.length}</span>}
          {listing && state.hits.length === 0 && <span class="ok">Listing OK</span>}
          {!listing && syncing && <span class="ok">Syncing…</span>}
          {!listing && !syncing && state.lastSync > 0 && <span class="ok">Synced {fmt.ago(state.lastSync)}</span>}
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
          <button class="btn sm icon ghost" title="Open dashboard" onClick={() => void send({ type: 'open-dashboard' })}>
            <External size={14} />
          </button>
          <button class="btn sm icon ghost" title="Close" onClick={() => { state.open = false; state.emit(); }}>
            <Close size={14} />
          </button>
        </div>
        <div class="body">
          <div>
            <h4>Account sync</h4>
            <div class="sync">
              <span class="grow">
                {syncing ? <>{state.sync?.phase}</> : state.lastSync ? <>Last synced {fmt.ago(state.lastSync)}</> : <>Not synced yet.</>}
              </span>
              <button
                class="btn sm"
                disabled={syncing}
                onClick={() => void send({ type: 'sync:start', mode: state.lastSync ? 'full' : 'connect', interactive: true })}
                title="Download your latest sales and products"
              >
                <Refresh size={13} /> Sync now
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

async function boot() {
  state.settings = await getSettings();
  const [drafts, sync, meta] = await Promise.all([get('drafts'), get('syncState'), get('meta')]);
  state.drafts = drafts;
  state.sync = sync;
  state.lastSync = meta.lastCaptureAt ?? 0;

  onStorageChange(['drafts', 'settings', 'syncState', 'meta'], async () => {
    const [d, s, m] = await Promise.all([get('drafts'), get('syncState'), get('meta')]);
    state.drafts = d;
    state.sync = s;
    state.lastSync = m.lastCaptureAt ?? 0;
    state.settings = await getSettings();
    state.emit();
  });

  chrome.runtime.onMessage.addListener((message: Message, _sender, respond) => {
    if (message.type === 'listing:fill') {
      state.scanFields();
      const filled = fillListing(state.fields, message.draft, message.overwrite);
      state.checkTrademarks();
      respond({ filled });
    }
    return false;
  });

  const host = document.createElement('loupe-dock');
  document.documentElement.appendChild(host);
  mount(host, BASE_CSS + DOCK_CSS, <><SyncBanner /><Dock /></>);

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

if (isTop) void boot();
