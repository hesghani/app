import { useEffect, useState } from 'preact/hooks';
import { toCsv } from '../../shared/csv';
import * as fmt from '../../shared/format';
import { MARKETPLACE_IDS, MARKETPLACES, merchSearchUrl, type Currency, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPES } from '../../shared/products';
import { TIER_LABELS, type RoyaltyTier } from '../../shared/royalty';
import { importSalesCsv, rowKey } from '../../shared/sales';
import { DEFAULT_SETTINGS, type Settings as SettingsT } from '../../shared/settings';
import { bump, clearStore, getAll, putMany, type Keyed } from '../../shared/db';
import { exportAll, get, importAll, saveSettings, set } from '../../shared/storage';
import type { CatalogItem, RangeTotal, SaleRow } from '../../shared/types';
import { ConnectCard, CopyReport } from './connect';
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

      <Card title={<h2 id="s-account">Merch account and sync</h2>}>
        <div class="stack">
          <ConnectCard data={data} compact />
          <Switch checked={settings.autoSync} onChange={(v) => void save({ autoSync: v })} label="Sync automatically" hint="Downloads today's sales on a schedule, and your product list once a day." />
          <Switch
            checked={settings.backgroundTabSync}
            onChange={(v) => void save({ backgroundTabSync: v })}
            label="Open Merch in a background tab when needed"
            hint="If no Merch tab is open, Loupe briefly opens one in the background to sync, then closes it."
          />
          <Switch checked={settings.notifications} onChange={(v) => void save({ notifications: v })} label="Notify me of new sales" />
          <Switch checked={settings.badge} onChange={(v) => void save({ badge: v })} label="Show today's units on the toolbar icon" />
          <div class="row wrap">
            <label class="field" style={{ width: '170px' }}><span>Sync every (minutes)</span><NumberInput value={settings.syncMinutes} min={10} max={720} onChange={(n) => void save({ syncMinutes: Math.max(10, n) })} /></label>
            <label class="field" style={{ width: '170px' }}><span>Sales history to download (days)</span><NumberInput value={settings.historyDays} min={30} max={1500} onChange={(n) => void save({ historyDays: Math.min(1500, Math.max(30, n)) })} /></label>
            <label class="field" style={{ width: '170px' }}>
              <span>Your tier (design slots)</span>
              <NumberInput value={settings.tier ?? data.account?.tier ?? 0} min={0} step={10} onChange={(n) => void save({ tier: n > 0 ? n : null })} />
              <span class="hint">{data.account?.tier ? `Merch reports tier ${data.account.tier}` : 'Used for slot math in the agent'}</span>
            </label>
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
                  if (meta.demo) {
                    await clearStore('sales');
                    await clearStore('catalog');
                  }
                  await putMany('sales', result.rows.map((r) => ({ ...r, key: rowKey(r) })));
                  await set('meta', { ...meta, demo: false });
                  await bump('sales', 'catalog');
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
            <button
              class="btn"
              onClick={async () => {
                const [storage, sales, catalog, totals] = await Promise.all([exportAll(), getAll('sales'), getAll('catalog'), getAll('totals')]);
                download(`loupe-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ loupeBackup: 2, storage, sales, catalog, totals }), 'application/json');
              }}
            >
              <Download size={14} /> Back up everything
            </button>
            <button
              class="btn"
              onClick={async () => {
                const file = await readFile('.json,application/json');
                if (!file) return;
                try {
                  const parsed = JSON.parse(file.text) as Record<string, unknown>;
                  const v2 = parsed.loupeBackup === 2;
                  if (!v2 && !('settings' in parsed || 'sales' in parsed)) throw new Error('Not a Loupe backup');
                  if (!confirm('Replace all Loupe data with this backup?')) return;
                  const storage = (v2 ? parsed.storage : parsed) as Record<string, unknown>;
                  const legacySales = !v2 && storage.sales && typeof storage.sales === 'object' ? Object.values(storage.sales as Record<string, SaleRow>) : [];
                  const { sales: _legacy, ...rest } = storage;
                  await importAll({ ...rest, meta: { ...((rest.meta as object) ?? {}), migratedToDb: true } });
                  await Promise.all([clearStore('sales'), clearStore('catalog'), clearStore('totals')]);
                  const sales = v2 ? (parsed.sales as Array<Keyed<SaleRow>>) : legacySales.map((r) => ({ ...r, key: rowKey(r) }));
                  await putMany('sales', sales);
                  if (v2) {
                    await putMany('catalog', parsed.catalog as CatalogItem[]);
                    await putMany('totals', parsed.totals as RangeTotal[]);
                  }
                  await bump('sales', 'catalog', 'totals');
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
                if (!confirm(`Delete all ${data.sales.length} sales rows and ${data.catalog.length} products?`)) return;
                await Promise.all([clearStore('sales'), clearStore('catalog'), clearStore('totals')]);
                await set('meta', { ...(await get('meta')), demo: false, coverage: undefined });
                await bump('sales', 'catalog', 'totals');
                void chrome.runtime.sendMessage({ type: 'badge:refresh' });
                toast('Sales cleared');
              }}
            >
              <Trash size={14} /> Clear sales and products
            </button>
            <button
              class="btn danger"
              onClick={async () => {
                if (!confirm('Delete everything Loupe has stored: sales, products, watchlist, drafts and settings?')) return;
                await chrome.storage.local.clear();
                await Promise.all([clearStore('sales'), clearStore('catalog'), clearStore('totals')]);
                await bump('sales', 'catalog', 'totals');
                void chrome.runtime.sendMessage({ type: 'badge:refresh' });
                toast('All data deleted');
              }}
            >
              <Trash size={14} /> Delete everything
            </button>
          </div>
        </div>
      </Card>

      <Card title={<h2 id="s-diagnostics">Sync diagnostics</h2>} actions={<CopyReport data={data} />}>
        <p class="hint" style={{ marginBottom: '10px' }}>
          Merch on Demand has no public API. Loupe learns from the requests Merch's own pages make while you're signed in, then repeats them for other dates,
          marketplaces and pages. This lists what it saw. The sync report describes these requests without any values, titles or personal data.
        </p>
        {data.templates.length > 0 && (
          <div class="table-wrap" style={{ marginBottom: '12px' }}>
            <table class="table">
              <thead><tr><th>Learned request</th><th>Kind</th><th>Dates</th><th>Paging</th><th class="num">Learned</th></tr></thead>
              <tbody>
                {data.templates.map((t) => (
                  <tr>
                    <td class="small" style={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{t.method} {new URL(t.url).pathname}</td>
                    <td><span class="pill neutral">{t.kind}{t.dated ? ' · daily' : ''}</span></td>
                    <td class="small">{t.window ? `${t.dates.map((d) => d.format).join(', ')}` : 'fixed'}</td>
                    <td class="small">{t.tokenKey ? 'token' : t.pages.map((p) => p.role).join(', ') || 'single page'}</td>
                    <td class="num muted small">{fmt.ago(t.capturedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.captureLog.length ? (
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Response</th><th class="num">Sales rows</th><th class="num">Products</th><th>Shape</th><th class="num">Seen</th></tr></thead>
              <tbody>
                {data.captureLog.map((e) => (
                  <tr>
                    <td class="small" style={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{e.path}</td>
                    <td class="num">{e.rows ? <span class="pill good">{e.rows}</span> : <span class="muted">0</span>}</td>
                    <td class="num">{e.items ? <span class="pill good">{e.items}</span> : <span class="muted">0</span>}</td>
                    <td class="small muted ellipsis" style={{ maxWidth: '280px' }} title={e.keys.join('\n')}>{e.keys.slice(0, 4).join(' · ')}</td>
                    <td class="num muted small">{fmt.ago(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Notice>Nothing seen yet. Click <b>Connect Merch account</b> above, or open merch.amazon.com.</Notice>
        )}
        {data.templates.length > 0 && (
          <p class="small muted" style={{ marginTop: '10px' }}>
            <button class="btn sm ghost" onClick={async () => { await set('templates', []); toast('Forgot learned requests. Loupe will relearn them on the next sync.'); }}>Forget learned requests</button>
          </p>
        )}
      </Card>
    </div>
  );
}
