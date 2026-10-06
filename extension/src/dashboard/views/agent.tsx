import { useMemo, useState } from 'preact/hooks';
import { analyzePortfolio, type Design, type Niche, type Portfolio, type Recommendation } from '../../shared/agent';
import { toCsv } from '../../shared/csv';
import { pacificDay } from '../../shared/dates';
import * as fmt from '../../shared/format';
import { MARKETPLACES, merchSearchUrl, productUrl } from '../../shared/marketplaces';
import { PRODUCT_TYPES } from '../../shared/products';
import { update } from '../../shared/storage';
import { Card, Empty, Notice, StatTile, useToast } from '../../ui/components';
import { Bulb, ChevronDown, ChevronUp, Copy, Download, External, Search, Wand } from '../../ui/icons';
import { navigate, type Data } from '../data';
import { ConnectCard, isConnected } from './connect';
import { PageHead } from './common';
import { download } from './download';
import { Planner } from './planner';

export function usePortfolio(data: Data): Portfolio {
  return useMemo(() => {
    const coverageFrom = data.meta.coverage?.salesFrom ?? (data.meta.demo ? data.sales.reduce((m, r) => (r.date < m ? r.date : m), '9999') : null);
    return analyzePortfolio({
      sales: data.sales,
      catalog: data.catalog,
      totals: data.totals,
      today: pacificDay(Date.now()),
      coverageFrom: coverageFrom === '9999' ? null : coverageFrom,
      historyFrom: data.meta.history?.from ?? null,
      currency: data.settings.displayCurrency,
      fx: data.settings.fx,
      designLimit: data.settings.tier ?? data.account?.tier ?? null,
      royalty: data.settings.royalty,
      tier: data.settings.royaltyTier,
    });
  }, [data.dbVersion, data.settings, data.account, data.meta.coverage?.salesFrom, data.meta.history?.from, data.meta.demo]);
}

const PRIORITY = { 1: ['Do now', 'bad'], 2: ['This week', 'warn'], 3: ['When you can', 'neutral'] } as const;

export function Agent({ data }: { data: Data }) {
  const p = usePortfolio(data);
  const [showDismissed, setShowDismissed] = useState(false);
  const money = (n: number) => fmt.money(n, data.settings.displayCurrency);
  const recs = p.recommendations.filter((r) => showDismissed || !data.agentDismissed.includes(r.id));
  const dismissedCount = p.recommendations.length - p.recommendations.filter((r) => !data.agentDismissed.includes(r.id)).length;
  const hasData = data.sales.length > 0 || data.catalog.length > 0;

  return (
    <div class="stack">
      <PageHead title="Agent" sub="Your whole portfolio, analyzed: what to upload next, what to scale, what to replace" />
      {(!isConnected(data) || data.syncState.status === 'running' || data.syncState.status === 'error' || data.syncState.status === 'signin') && <ConnectCard data={data} />}
      {data.meta.demo && <Notice>You're looking at <b>sample data</b>. Connect your Merch account to analyze your real portfolio.</Notice>}
      {isConnected(data) && data.syncState.status !== 'running' && <ConnectCard data={data} compact />}

      {!hasData ? (
        <Card><Empty icon={<Wand size={22} />} title="Nothing to analyze yet"><p>Connect your Merch account above. The agent reads every design, its sales and its niche.</p></Empty></Card>
      ) : (
        <>
          <div class="grid-4">
            <StatTile
              label="Live designs"
              value={fmt.int(p.liveDesigns)}
              hint={p.catalogKnown ? `${fmt.int(p.liveProducts)} live products` : 'Designs with sales in the last year (sync your product list for the full count)'}
            />
            <StatTile label="Designs that sold (90 days)" value={p.liveDesigns ? `${fmt.int(p.sold90)} · ${fmt.pct(p.hitRate90)}` : '–'} hint="Share of live designs with at least one sale in 90 days" />
            <StatTile label="Royalties (90 days)" value={money(p.royalty90)} hint={`${fmt.int(p.units90)} units`} />
            <StatTile label="Units (30 days)" value={fmt.int(p.units30)} hint={`${fmt.int(p.sold30)} designs sold in 30 days`} />
          </div>
          {p.designLimit !== null && (
            <div class="card" style={{ padding: '12px 16px' }}>
              <div class="row small"><b>Design slots</b><span class="muted">{fmt.int(p.liveDesigns)} of {fmt.int(p.designLimit)} used</span><span class="right muted">{fmt.pct(p.liveDesigns / p.designLimit)}</span></div>
              <div class="progress" style={{ marginTop: '8px' }}><div style={{ width: `${Math.min(100, (p.liveDesigns / p.designLimit) * 100)}%` }} /></div>
            </div>
          )}
          {!p.catalogKnown && (
            <Notice kind="warn">
              Loupe hasn't read your product list yet, so it can't see designs that never sold. Open <b>Manage</b> on Merch once (or click Sync now) to find dead designs.
            </Notice>
          )}

          <Planner portfolio={p} />

          <div class="row">
            <h2 class="grow">Next best actions</h2>
            {dismissedCount > 0 && (
              <button class="btn sm ghost" onClick={() => setShowDismissed(!showDismissed)}>{showDismissed ? 'Hide done' : `Show ${dismissedCount} done`}</button>
            )}
          </div>
          {recs.length ? recs.map((r) => <RecCard key={r.id} rec={r} data={data} portfolio={p} dismissed={data.agentDismissed.includes(r.id)} />) : (
            <Card><p class="muted">No actions right now. Check back after the next sync.</p></Card>
          )}

          <NicheTable niches={p.niches} data={data} />

          <div class="grid-2" style={{ alignItems: 'start' }}>
            <Card title="Product types" pad={false}>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Type</th><th class="num">Listings</th><th class="num">Units 90d</th><th class="num">Royalty per listing</th></tr></thead>
                  <tbody>
                    {p.typeMix.map((t) => (
                      <tr><td>{PRODUCT_TYPES[t.type].label}</td><td class="num">{fmt.int(t.listings)}</td><td class="num">{fmt.int(t.units90)}</td><td class="num">{t.listings ? money(t.perListing) : '–'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Marketplaces" pad={false}>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Marketplace</th><th class="num">Live listings</th><th class="num">Units 90d</th><th class="num">Royalties 90d</th></tr></thead>
                  <tbody>
                    {p.marketMix.map((m) => (
                      <tr><td>{MARKETPLACES[m.marketplace].flag} {MARKETPLACES[m.marketplace].name}</td><td class="num">{p.catalogKnown ? fmt.int(m.listings) : '–'}</td><td class="num">{fmt.int(m.units90)}</td><td class="num">{money(m.royalty90)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function asinsOf(designs: Design[]): string[] {
  return Array.from(new Set(designs.flatMap((d) => d.products.filter((p) => p.asin && p.status !== 'removed' && p.status !== 'rejected').map((p) => p.asin!))));
}

function RecCard({ rec, data, portfolio, dismissed }: { rec: Recommendation; data: Data; portfolio: Portfolio; dismissed: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(rec.priority === 1 && rec.designs.length > 0 && rec.designs.length <= 12);
  const [label, tone] = PRIORITY[rec.priority];
  const niches = rec.niche ? portfolio.niches.filter((n) => rec.niche!.split('|').includes(n.name)) : [];
  const money = (n: number) => fmt.money(n, data.settings.displayCurrency);

  return (
    <section class={`card rec ${dismissed ? 'done' : ''}`}>
      <div class="card-body stack" style={{ gap: '10px' }}>
        <div class="row top">
          <span class={`pill ${tone}`}>{label}</span>
          <div class="grow">
            <h2>{rec.title}</h2>
            <p class="muted small" style={{ marginTop: '4px' }}>{rec.why}</p>
            {rec.impact && <p class="small" style={{ marginTop: '4px' }}><b>{rec.impact}</b></p>}
          </div>
          <button
            class="btn sm ghost"
            onClick={() => void update('agentDismissed', (list) => (dismissed ? list.filter((x) => x !== rec.id) : [...list, rec.id]))}
            title={dismissed ? 'Bring back' : 'Mark as done'}
          >
            {dismissed ? 'Undo' : 'Done'}
          </button>
        </div>

        {niches.length > 0 && (
          <div class="chips">
            {niches.map((n) => (
              <button class="chip" onClick={() => navigate('research', { q: n.name })} title={`${n.designs} designs · ${fmt.pct(n.hitRate)} sold · ${n.perDesign.toFixed(1)} units each in 90 days`}>
                <Search size={12} /> {n.name} <span class="muted">{n.perDesign.toFixed(1)}/design</span>
              </button>
            ))}
          </div>
        )}

        {rec.designs.length > 0 && (
          <div class="row wrap">
            <button class="btn sm" onClick={() => setOpen(!open)}>
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {rec.designs.length.toLocaleString()} designs
            </button>
            <button
              class="btn sm"
              onClick={async () => {
                const asins = asinsOf(rec.designs);
                await navigator.clipboard.writeText(asins.join('\n'));
                toast(`Copied ${asins.length} ASINs`);
              }}
            >
              <Copy size={13} /> ASINs
            </button>
            <button
              class="btn sm"
              onClick={() =>
                download(`loupe-${rec.kind}.csv`, toCsv([
                  ['Design', 'Brand', 'Product types', 'Marketplaces', 'Units 30d', 'Units 90d', 'Units 365d', `Royalties 90d ${data.settings.displayCurrency}`, 'Last sale', 'Age (days)', 'Note', 'ASINs'],
                  ...rec.designs.map((d) => [d.title, d.brand, d.types.map((t) => PRODUCT_TYPES[t].short).join(' '), d.marketplaces.join(' '), d.u30, d.u90, d.u365, d.r90.toFixed(2), d.lastSale ?? '', d.ageDays ?? '', rec.detail?.[d.key] ?? '', asinsOf([d]).join(' ')]),
                ]))
              }
            >
              <Download size={13} /> CSV
            </button>
          </div>
        )}

        {open && rec.designs.length > 0 && (
          <div class="table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table class="table">
              <thead>
                <tr><th>Design</th><th>Products</th><th class="num">30d</th><th class="num">90d</th><th class="num">365d</th><th class="num">Royalties 90d</th><th class="num">Last sale</th><th class="num">Age</th>{rec.detail && <th>Next step</th>}</tr>
              </thead>
              <tbody>
                {rec.designs.slice(0, 300).map((d) => {
                  const first = d.products.find((x) => x.asin && x.marketplace);
                  return (
                    <tr>
                      <td>
                        <div class="title-cell">
                          {first ? (
                            <a class="t" href={productUrl(first.marketplace!, first.asin!)} target="_blank" rel="noopener" title={d.title}>{d.title || first.asin}</a>
                          ) : (
                            <span class="t" title={d.title}>{d.title}</span>
                          )}
                        </div>
                      </td>
                      <td class="small ink2 nowrap">{d.types.map((t) => PRODUCT_TYPES[t].short).join(', ') || '–'} {d.marketplaces.map((m) => MARKETPLACES[m].flag).join('')}</td>
                      <td class="num">{fmt.int(d.u30)}</td>
                      <td class="num">{fmt.int(d.u90)}</td>
                      <td class="num">{fmt.int(d.u365)}</td>
                      <td class="num">{money(d.r90)}</td>
                      <td class="num muted">{fmt.day(d.lastSale)}</td>
                      <td class="num muted">{fmt.age(d.ageDays)}</td>
                      {rec.detail && <td class="small">{rec.detail[d.key] ?? ''}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rec.designs.length > 300 && <p class="muted small" style={{ padding: '8px 12px' }}>Showing 300 of {rec.designs.length}. Export the CSV for the full list.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

const VERDICT = {
  'double-down': ['Double down', 'good'],
  rising: ['Rising', 'brand'],
  keep: ['Keep', 'neutral'],
  stop: ['Stop', 'bad'],
} as const;

function NicheTable({ niches, data }: { niches: Niche[]; data: Data }) {
  if (!niches.length) return null;
  const money = (n: number) => fmt.money(n, data.settings.displayCurrency);
  return (
    <Card title="Your niches" actions={<span class="muted small">Grouped from the words in your design titles</span>} pad={false}>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Niche</th><th class="num">Designs</th><th class="num">Sold (90d)</th><th class="num">Units per design</th><th class="num">Units 30d vs before</th><th class="num">Royalties 90d</th><th>Verdict</th><th /></tr>
          </thead>
          <tbody>
            {niches.map((n) => {
              const [label, tone] = VERDICT[n.verdict];
              const before = n.prev60 / 2;
              return (
                <tr>
                  <td title={n.examples.join(' · ')}><b>{n.name}</b></td>
                  <td class="num">{fmt.int(n.designs)}</td>
                  <td class="num">{fmt.int(n.sold90)} · {fmt.pct(n.hitRate)}</td>
                  <td class="num">{n.perDesign.toFixed(1)}</td>
                  <td class="num">{fmt.int(n.u30)} vs {fmt.int(before)}</td>
                  <td class="num">{money(n.r90)}</td>
                  <td><span class={`pill ${tone}`}>{label}</span></td>
                  <td class="num nowrap">
                    <button class="btn sm icon ghost" title="Keyword ideas for this niche" onClick={() => navigate('research', { q: n.name })}><Bulb size={13} /></button>
                    <a class="btn sm icon ghost" title="See competing Merch shirts on Amazon" href={merchSearchUrl(data.settings.marketplace, n.name, data.settings.searchTemplates[data.settings.marketplace])} target="_blank" rel="noopener"><External size={13} /></a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
