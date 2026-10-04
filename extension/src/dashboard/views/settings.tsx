import { useEffect, useState } from 'preact/hooks';
import { toCsv } from '../../shared/csv';
import * as fmt from '../../shared/format';
import { MARKETPLACE_IDS, MARKETPLACES, merchSearchUrl, type Currency, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPES } from '../../shared/products';
import { TIER_LABELS, type RoyaltyTier } from '../../shared/royalty';
import { importSalesCsv, rowKey } from '../../shared/sales';
import { DEFAULT_SETTINGS, type Settings as SettingsT } from '../../shared/settings';
import { exportAll, get, importAll, saveSettings, set } from '../../shared/storage';
import { Card, Notice, NumberInput, Seg, Switch, useToast } from '../../ui/components';
import { Download, Trash, Upload } from '../../ui/icons';
import type { Data, Route } from '../data';
import { CurrencySelect, MarketplaceSelect, PageHead } from './common';
import { download, readFile } from './download';
import { loadDemo } from './welcome';

export function Settings({ data, route }: { data: Data; route: Route }) {
  const { settings } = data;
  const toast = useToast();
  const [csvMp, setCsvMp] = useState<MarketplaceId>(settings.marketplace);

  useEffect(() => {
    const section = route.params.get('section');
    if (section) document.getElementById(`s-${section}`)?.scrollIntoView({ behavior: 'smooth' });
  }, [route.params.get('section')]);

  const save = async (patch: Partial<SettingsT>) => {
    await saveSettings(patch);
    void chrome.runtime.sendMessage({ type: 'settings:changed' });
  };

  return (
    <div class="stack" style={{ maxWidth: '920px' }}>
      <PageHead title="Settings" sub="Everything is stored locally in this browser profile" />

      <Card title="General">
        <div class="stack">
          <div class="row wrap">
            <label class="field"><span>Default marketplace</span><MarketplaceSelect value={settings.marketplace} onChange={(v) => void save({ marketplace: v as MarketplaceId })} /></label>
            <label class="field"><span>Show money in</span><CurrencySelect value={settings.displayCurrency} onChange={(c) => void save({ displayCurrency: c })} /></label>
            <label class="field"><span>Your royalty tier</span>
              <Seg<RoyaltyTier> label="Royalty tier" value={settings.royaltyTier} onChange={(t) => void save({ royaltyTier: t })} options={(['creator', 'plus', 'premium'] as RoyaltyTier[]).map((t) => [t, TIER_LABELS[t]])} />
            </label>
          </div>
          <div>
            <div class="field-label" style={{ marginBottom: '6px' }}>Exchange rates (value of 1 unit in USD)</div>
            <div class="row wrap">
              {(['EUR', 'GBP', 'JPY'] as Currency[]).map((c) => (
                <label class="row small">
                  <span class="nowrap">1 {c} =</span>
                  <NumberInput class="sm" value={settings.fx[c]} step={c === 'JPY' ? 0.0001 : 0.01} onChange={(n) => n > 0 && void save({ fx: { ...settings.fx, [c]: n } })} label={`${c} rate`} />
                  <span>USD</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Amazon research">
        <div class="stack">
          <Switch checked={settings.overlayEnabled} onChange={(v) => void save({ overlayEnabled: v })} label="Show Loupe on Amazon" hint="Toolbar and badges on search pages, panel on product pages." />
          <Switch checked={settings.autoAnalyze} onChange={(v) => void save({ autoAnalyze: v })} label="Analyze search results automatically" hint="Off: click “Analyze page” in the toolbar when you want data." />
          <Switch checked={settings.productPanel} onChange={(v) => void save({ productPanel: v })} label="Show the product page panel" />
          <div class="row wrap">
            <label class="field"><span>Products fetched at once</span>
              <Seg<string> label="Concurrency" value={String(settings.concurrency)} onChange={(v) => void save({ concurrency: Number(v) })} options={[['1', '1 (gentlest)'], ['2', '2'], ['3', '3'], ['4', '4 (fastest)']]} />
            </label>
            <label class="field" style={{ width: '170px' }}><span>Reuse product data for (hours)</span><NumberInput value={settings.cacheHours} min={0} max={168} onChange={(n) => void save({ cacheHours: Math.max(0, n) })} /></label>
          </div>
          <div>
            <div class="field-label" style={{ marginBottom: '6px' }}>BSR color bands</div>
            <div class="row wrap small">
              <span class="row"><span class="dot heat-hot" /> Hot up to</span>
              <NumberInput class="sm" value={settings.heat.hot} step={1000} onChange={(n) => void save({ heat: { ...settings.heat, hot: n } })} label="Hot threshold" />
              <span class="row"><span class="dot heat-good" /> Good up to</span>
              <NumberInput class="sm" value={settings.heat.good} step={10000} onChange={(n) => void save({ heat: { ...settings.heat, good: n } })} label="Good threshold" />
              <span class="row"><span class="dot heat-ok" /> Selling up to</span>
              <NumberInput class="sm" value={settings.heat.ok} step={50000} onChange={(n) => void save({ heat: { ...settings.heat, ok: n } })} label="Selling threshold" />
              <span class="row"><span class="dot heat-slow" /> Slow up to</span>
              <NumberInput class="sm" value={settings.heat.slow} step={100000} onChange={(n) => void save({ heat: { ...settings.heat, slow: n } })} label="Slow threshold" />
            </div>
          </div>
          <details>
            <summary class="small" style={{ cursor: 'pointer' }}>Merch search URLs (advanced)</summary>
            <p class="hint" style={{ margin: '8px 0' }}>Loupe filters searches to Merch shirts with Amazon's stock Merch bullet text. Override per marketplace with any URL containing <code>{'{keyword}'}</code>.</p>
            <div class="stack">
              {MARKETPLACE_IDS.map((id) => (
                <label class="field">
                  <span>{MARKETPLACES[id].flag} {MARKETPLACES[id].name}</span>
                  <input
                    class="input sm"
                    placeholder={merchSearchUrl(id, '{keyword}').replace('%7Bkeyword%7D', '{keyword}')}
                    value={settings.searchTemplates[id] ?? ''}
                    onChange={(e) => void save({ searchTemplates: { ...settings.searchTemplates, [id]: (e.target as HTMLInputElement).value.trim() || undefined } })}
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
      </Card>

      <Card title="Merch on Demand sync">
        <div class="stack">
          <Switch checked={settings.notifications} onChange={(v) => void save({ notifications: v })} label="Notify me of new sales" hint="A desktop notification when a synced report shows new units today." />
          <Switch checked={settings.badge} onChange={(v) => void save({ badge: v })} label="Show today's units on the toolbar icon" />
          <Switch
            checked={settings.liveRefresh}
            onChange={(v) => void save({ liveRefresh: v })}
            label="Live refresh"
            hint="While a Merch tab is open, quietly re-load the sales reports Loupe has seen, so notifications arrive without you clicking around."
          />
          <div class="row wrap">
            <label class="field" style={{ width: '170px' }}><span>Live refresh every (minutes)</span><NumberInput value={settings.liveRefreshMinutes} min={5} max={240} onChange={(n) => void save({ liveRefreshMinutes: Math.max(5, n) })} /></label>
            <label class="field" style={{ width: '200px' }}><span>Merch removes listings idle for (months)</span><NumberInput value={settings.inactivityMonths} min={1} max={60} onChange={(n) => void save({ inactivityMonths: Math.max(1, n) })} /></label>
            <label class="field" style={{ width: '200px' }}><span>Re-check tracked BSRs every (hours)</span><NumberInput value={settings.watchRefreshHours} min={1} max={168} onChange={(n) => void save({ watchRefreshHours: Math.max(1, n) })} /></label>
          </div>
        </div>
      </Card>

      <Card title="Royalty model">
        <p class="hint" style={{ marginBottom: '10px' }}>royalty = (price without VAT × (1 − referral) − production cost) × Creator share × tier multiplier. Calibrate costs on the Royalties page.</p>
        <div class="row wrap">
          <label class="field" style={{ width: '130px' }}><span>Referral fee</span><NumberInput value={settings.royalty.referralRate} step={0.01} onChange={(n) => void save({ royalty: { ...settings.royalty, referralRate: n } })} /></label>
          <label class="field" style={{ width: '130px' }}><span>Creator share</span><NumberInput value={settings.royalty.creatorShare} step={0.01} onChange={(n) => void save({ royalty: { ...settings.royalty, creatorShare: n } })} /></label>
          {(['plus', 'premium'] as RoyaltyTier[]).map((t) => (
            <label class="field" style={{ width: '130px' }}>
              <span>{TIER_LABELS[t]} multiplier</span>
              <NumberInput value={settings.royalty.tierMultipliers[t]} step={0.01} onChange={(n) => void save({ royalty: { ...settings.royalty, tierMultipliers: { ...settings.royalty.tierMultipliers, [t]: n } } })} />
            </label>
          ))}
          <button class="btn ghost" style={{ alignSelf: 'flex-end' }} onClick={() => void save({ royalty: DEFAULT_SETTINGS.royalty })}>Reset model</button>
        </div>
        {Object.keys(settings.royalty.costOverrides).length > 0 && (
          <p class="small muted" style={{ marginTop: '10px' }}>
            Calibrated: {Object.entries(settings.royalty.costOverrides).flatMap(([type, mps]) => Object.keys(mps ?? {}).map((m) => `${PRODUCT_TYPES[type as keyof typeof PRODUCT_TYPES].short} ${m}`)).join(', ')}
          </p>
        )}
      </Card>

      <Card title={<h2 id="s-data">Data</h2>}>
        <div class="stack">
          <div>
            <div class="field-label">Import sales from CSV</div>
            <p class="hint" style={{ margin: '4px 0 8px' }}>Any CSV with a date, ASIN and units or royalty column works. Columns are matched by name. Rows without a marketplace use the one you pick.</p>
            <div class="row wrap">
              <MarketplaceSelect value={csvMp} onChange={(v) => setCsvMp(v as MarketplaceId)} />
              <button
                class="btn"
                onClick={async () => {
                  const file = await readFile('.csv,text/csv,.tsv,.txt');
                  if (!file) return;
                  const result = importSalesCsv(file.text, csvMp);
                  if (!result.rows.length) {
                    toast(`No sales rows found. Columns seen: ${result.headers.slice(0, 6).join(', ')}`);
                    return;
                  }
                  const meta = await get('meta');
                  const store = meta.demo ? {} : await get('sales');
                  for (const r of result.rows) store[rowKey(r)] = r;
                  await set('sales', store);
                  await set('meta', { ...meta, demo: false });
                  toast(`Imported ${result.rows.length} rows${result.skipped ? `, skipped ${result.skipped}` : ''}`);
                }}
              >
                <Upload size={14} /> Choose CSV
              </button>
              <button
                class="btn"
                disabled={!data.sales.length}
                onClick={() => {
                  const rows = [...data.sales].sort((a, b) => a.date.localeCompare(b.date));
                  download('loupe-sales.csv', toCsv([
                    ['Date', 'Marketplace', 'ASIN', 'Title', 'Product type', 'Units', 'Cancelled', 'Returned', 'Royalty', 'Currency', 'Source'],
                    ...rows.map((r) => [r.date, r.marketplace, r.asin, r.title, r.productType ? PRODUCT_TYPES[r.productType].label : '', r.units, r.cancelled, r.returned, r.royalty.toFixed(2), r.currency, r.source]),
                  ]));
                }}
              >
                <Download size={14} /> Export sales CSV
              </button>
            </div>
          </div>
          <div class="divider" />
          <div class="row wrap">
            <button class="btn" onClick={async () => download(`loupe-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportAll()), 'application/json')}>
              <Download size={14} /> Back up everything
            </button>
            <button
              class="btn"
              onClick={async () => {
                const file = await readFile('.json,application/json');
                if (!file) return;
                try {
                  const parsed = JSON.parse(file.text) as Record<string, unknown>;
                  if (typeof parsed !== 'object' || !parsed || !('settings' in parsed || 'sales' in parsed)) throw new Error('Not a Loupe backup');
                  if (!confirm('Replace all Loupe data with this backup?')) return;
                  await importAll(parsed);
                  toast('Backup restored');
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <Upload size={14} /> Restore backup
            </button>
            <button class="btn" onClick={async () => { await loadDemo(); toast('Loaded sample sales'); }}>Load sample data</button>
          </div>
          <div class="divider" />
          <div class="row wrap">
            <button
              class="btn danger"
              disabled={!data.sales.length}
              onClick={async () => {
                if (!confirm(`Delete all ${data.sales.length} sales rows?`)) return;
                await set('sales', {});
                await set('meta', { ...(await get('meta')), demo: false });
                void chrome.runtime.sendMessage({ type: 'badge:refresh' });
                toast('Sales cleared');
              }}
            >
              <Trash size={14} /> Clear sales
            </button>
            <button
              class="btn danger"
              onClick={async () => {
                if (!confirm('Delete everything Loupe has stored: sales, watchlist, drafts and settings?')) return;
                await chrome.storage.local.clear();
                void chrome.runtime.sendMessage({ type: 'badge:refresh' });
                toast('All data deleted');
              }}
            >
              <Trash size={14} /> Delete everything
            </button>
          </div>
        </div>
      </Card>

      <Card title={<h2 id="s-diagnostics">Sync diagnostics</h2>}>
        <p class="hint" style={{ marginBottom: '10px' }}>
          Merch on Demand has no public API. Loupe reads the JSON its dashboard loads and keeps any records that look like sales (an ASIN plus units or royalties).
          If sales don't appear, this shows what Loupe saw.
        </p>
        {data.captureLog.length ? (
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Endpoint</th><th class="num">Sales rows</th><th>Shape</th><th class="num">Seen</th></tr></thead>
              <tbody>
                {data.captureLog.map((e) => (
                  <tr>
                    <td class="small" style={{ fontFamily: 'ui-monospace, monospace' }}>{e.path}</td>
                    <td class="num">{e.rows ? <span class="pill good">{e.rows}</span> : <span class="muted">0</span>}</td>
                    <td class="small muted ellipsis" style={{ maxWidth: '280px' }} title={e.keys.join(', ')}>{e.keys.join(', ')}</td>
                    <td class="num muted small">{fmt.ago(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Notice>Nothing captured yet. Open merch.amazon.com and visit your sales report.</Notice>
        )}
        {data.replay.length > 0 && (
          <p class="small muted" style={{ marginTop: '10px' }}>
            Refresh re-loads {data.replay.length} report{data.replay.length > 1 ? 's' : ''}: {data.replay.map((t) => new URL(t.url).pathname).join(', ')}.{' '}
            <button class="btn sm ghost" onClick={async () => { await set('replay', []); toast('Forgot saved reports'); }}>Forget</button>
          </p>
        )}
      </Card>
    </div>
  );
}
