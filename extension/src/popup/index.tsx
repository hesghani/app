import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { filterRows, totals } from '../shared/analytics';
import { addDays, pacificDay, resolveRange } from '../shared/dates';
import { salesBetween } from '../shared/db';
import * as fmt from '../shared/format';
import type { Message } from '../shared/messages';
import { merchSearchUrl, type MarketplaceId } from '../shared/marketplaces';
import type { Settings } from '../shared/settings';
import { get, getSettings, onStorageChange, type Meta } from '../shared/storage';
import { scanText, usptoUrl } from '../shared/trademark';
import type { SaleRow, SyncState } from '../shared/types';
import { Alert, Bulb, Chart, Eye, Logo, Refresh, Search, Settings as SettingsIcon, Shield, Wand } from '../ui/icons';
import { MarketplaceSelect } from '../dashboard/views/common';

function open(hash: string) {
  void chrome.runtime.sendMessage({ type: 'open-dashboard', hash } satisfies Message);
  window.close();
}

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [meta, setMeta] = useState<Meta>({});
  const [keyword, setKeyword] = useState('');
  const [mp, setMp] = useState<MarketplaceId>('US');
  const [tm, setTm] = useState('');
  const [syncState, setSyncState] = useState<SyncState | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = pacificDay(Date.now());
      const [s, rows, m, sync] = await Promise.all([getSettings(), salesBetween(addDays(today, -40), today), get('meta'), get('syncState')]);
      setSettings(s);
      setSales(rows);
      setMeta(m);
      setSyncState(sync);
      setMp((current) => (current === 'US' ? s.marketplace : current));
    };
    void load();
    return onStorageChange(['dataVersion', 'meta', 'settings', 'syncState'], () => void load());
  }, []);

  const stats = useMemo(() => {
    if (!settings) return null;
    const today = pacificDay(Date.now());
    const day = (d: string) => totals(filterRows(sales, { range: { from: d, to: d } }), settings.displayCurrency, settings.fx);
    const month = resolveRange('month', today);
    return {
      today: day(today),
      yesterday: day(addDays(today, -1)),
      month: totals(filterRows(sales, { range: month }), settings.displayCurrency, settings.fx),
    };
  }, [sales, settings]);

  const hits = useMemo(() => (tm.trim() ? scanText({ text: tm }, { custom: settings?.customTerms, ignore: settings?.ignoredTerms }) : []), [tm, settings]);

  if (!settings || !stats) return null;
  const money = (n: number) => fmt.money(n, settings.displayCurrency);

  return (
    <div class="pop">
      <div class="pop-head">
        <Logo size={22} />
        <b>Loupe</b>
        <span class="muted tiny">{meta.demo ? 'sample data' : meta.lastCaptureAt ? `synced ${fmt.ago(meta.lastCaptureAt)}` : 'not synced'}</span>
        <button class="btn sm icon ghost right" title="Settings" onClick={() => open('settings')}><SettingsIcon size={15} /></button>
      </div>

      {sales.length ? (
        <div class="card">
          <div class="pop-stats">
            <div class="stat">
              <div class="label">Today</div>
              <div class="value">{fmt.int(stats.today.units)}</div>
              <div class="delta"><span class="vs">{money(stats.today.royalty)} · yesterday {fmt.int(stats.yesterday.units)}</span></div>
            </div>
            <div class="stat" style={{ borderLeft: '1px solid var(--line)' }}>
              <div class="label">This month</div>
              <div class="value">{fmt.int(stats.month.units)}</div>
              <div class="delta"><span class="vs">{money(stats.month.royalty)}</span></div>
            </div>
          </div>
          <div class="card-foot row">
            <span class="muted small grow">
              {syncState?.status === 'running' ? syncState.phase : syncState?.status === 'signin' ? 'Sign in to Merch to keep syncing' : `Synced ${fmt.ago(meta.lastCaptureAt)}`}
            </span>
            <button
              class="btn sm"
              disabled={syncState?.status === 'running'}
              onClick={() => void chrome.runtime.sendMessage({ type: 'sync:start', mode: meta.demo || !meta.lastCaptureAt ? 'connect' : 'quick', interactive: true } satisfies Message)}
            >
              <Refresh size={13} /> Sync
            </button>
          </div>
        </div>
      ) : (
        <div class="card" style={{ padding: '12px' }}>
          <p class="small"><b>{syncState?.status === 'running' ? 'Syncing your Merch account…' : 'Not connected yet.'}</b> {syncState?.status === 'running' ? syncState.phase : 'Loupe uses the Merch session you are signed in with to download your sales and products.'}</p>
          <div class="row" style={{ marginTop: '8px' }}>
            <button class="btn sm primary" disabled={syncState?.status === 'running'} onClick={() => void chrome.runtime.sendMessage({ type: 'sync:start', mode: 'connect', interactive: true } satisfies Message)}>
              <Refresh size={13} /> Connect Merch account
            </button>
            <button class="btn sm" onClick={() => open('welcome')}>Get started</button>
          </div>
        </div>
      )}

      <form
        class="card"
        style={{ padding: '10px', display: 'grid', gap: '8px' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!keyword.trim()) return;
          void chrome.tabs.create({ url: merchSearchUrl(mp, keyword, settings.searchTemplates[mp]) });
        }}
      >
        <label class="field-label" for="kw">Search Merch shirts on Amazon</label>
        <div class="row">
          <input id="kw" class="input sm grow" placeholder="e.g. retro pickleball" value={keyword} onInput={(e) => setKeyword((e.target as HTMLInputElement).value)} />
          <MarketplaceSelect small value={mp} onChange={(v) => setMp(v as MarketplaceId)} />
        </div>
        <div class="row">
          <button class="btn sm primary" type="submit" disabled={!keyword.trim()}><Search size={13} /> Search</button>
          <button class="btn sm" type="button" disabled={!keyword.trim()} onClick={() => open(`research?q=${encodeURIComponent(keyword)}&mp=${mp}`)}>
            <Bulb size={13} /> Keyword ideas
          </button>
        </div>
      </form>

      <div class="card" style={{ padding: '10px', display: 'grid', gap: '8px' }}>
        <label class="field-label" for="tm">Quick trademark check</label>
        <input id="tm" class="input sm" placeholder="Paste a title or phrase" value={tm} onInput={(e) => setTm((e.target as HTMLInputElement).value)} />
        {tm.trim() && (
          <div class="small">
            {hits.length ? (
              <ul class="hits">
                {hits.slice(0, 4).map((h) => (
                  <li class={`sev-${h.severity}`}><Alert size={13} /><span><b>{h.term}</b>: <span class="muted">{h.reason}</span></span></li>
                ))}
              </ul>
            ) : (
              <span class="row" style={{ color: 'var(--good-ink)' }}><Shield size={13} /> No known risky terms</span>
            )}
            <a href={usptoUrl(tm.trim())} target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: '6px' }}>Search “{tm.trim().slice(0, 40)}” on USPTO ↗</a>
          </div>
        )}
      </div>

      <div class="navgrid">
        <button onClick={() => open('agent')}><Wand size={17} />Agent</button>
        <button onClick={() => open('overview')}><Chart size={17} />Sales</button>
        <button onClick={() => open('research')}><Search size={17} />Research</button>
        <button onClick={() => open('watchlist')}><Eye size={17} />Watchlist</button>

      </div>
    </div>
  );
}

render(<Popup />, document.getElementById('app')!);
