// Designs: your listings grouped by the artwork they share, with a picture,
// where each design is live, its statuses and what it sold.

import { useMemo, useState } from 'preact/hooks';
import { addDays } from '../../shared/dates';
import { dailySeries, filterRows } from '../../shared/analytics';
import { toCsv } from '../../shared/csv';
import * as fmt from '../../shared/format';
import { MARKETPLACES, productUrl } from '../../shared/marketplaces';
import { PRODUCT_TYPES, type ProductType } from '../../shared/products';
import { ColumnChart } from '../../ui/charts';
import { Card, Empty, Seg } from '../../ui/components';
import { Arrow, Download, External, Layers } from '../../ui/icons';
import type { Data } from '../data';
import { PageHead, usePersistent } from './common';
import { download } from './download';
import {
  createdMatches, FilterBar, NO_FILTERS, PERIOD_LABEL, Preview, soldMatches, STATUS_LABEL, STATUS_TONE, useInventory,
  type DesignRow, type Filters, type Period, type Status,
} from './inventory';
import { Pager } from './products';

type SortKey = 'title' | 'created' | 'sold' | 'royalty' | 'lastSale' | 'products';
const PAGE = 60;

export function Designs({ data }: { data: Data }) {
  const { designs, today } = useInventory(data);
  const [f, setF] = usePersistent<Filters>('designs-filters', NO_FILTERS);
  const [period, setPeriod] = usePersistent<Period>('designs-period', 'all');
  const [sort, setSort] = usePersistent<{ key: SortKey; desc: boolean }>('designs-sort', { key: 'sold', desc: true });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const list = designs.filter((d) => {
      // A design matches when one of its listings matches the listing filters.
      const listings = d.listings.filter(
        (l) =>
          (f.mp === 'ALL' || l.marketplace === f.mp) &&
          (f.type === 'ALL' || l.productType === f.type) &&
          (f.status === 'ALL' || l.status === f.status) &&
          (f.searchable === 'any' || (f.searchable === 'yes' ? l.searchable === true : l.searchable === false)),
      );
      return (
        listings.length > 0 &&
        (!q || d.title.toLowerCase().includes(q) || d.brand.toLowerCase().includes(q) || d.listings.some((l) => (l.asin ?? '').toLowerCase().includes(q))) &&
        createdMatches(d.createdAt, f, today) &&
        soldMatches(d.sold, f)
      );
    });
    const value = (d: DesignRow): number | string => {
      switch (sort.key) {
        case 'title': return d.title.toLowerCase();
        case 'created': return d.createdAt ?? '';
        case 'lastSale': return d.lastSale ?? '';
        case 'products': return d.listings.length;
        case 'royalty': return period === 'all' ? d.sold.royaltyAll : d.sold.royalty365;
        default: return d.sold[period];
      }
    };
    return list.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -c : c;
    });
  }, [designs, f, sort, period, today]);

  const types = useMemo(() => Array.from(new Set(designs.flatMap((d) => d.types))) as ProductType[], [designs]);
  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const d of designs) for (const s of Object.keys(d.statuses) as Status[]) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [designs]);
  const live = designs.filter((d) => d.statuses.live).length;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const currency = data.settings.displayCurrency;

  if (!designs.length) {
    return (
      <div class="stack">
        <PageHead title="Designs" />
        <Card><Empty icon={<Layers size={22} />} title="No designs yet"><p>Sync your Merch account and your designs appear here, grouped across product types and marketplaces.</p></Empty></Card>
      </div>
    );
  }

  const head = (key: SortKey, text: string, num = true) => (
    <th class={num ? 'num' : ''} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => { setSort({ key, desc: sort.key === key ? !sort.desc : key !== 'title' }); setPage(0); }}>
        {text}
        {sort.key === key && <Arrow dir={sort.desc ? 'down' : 'up'} size={11} />}
      </button>
    </th>
  );

  return (
    <div class="stack">
      <PageHead title="Designs" sub={`${fmt.int(live)} live designs of ${fmt.int(designs.length)} · grouped across product types and marketplaces`}>
        <button
          class="btn sm"
          onClick={() =>
            download('loupe-designs.csv', toCsv([
              ['Design', 'Brand', 'Products', 'Product types', 'Marketplaces', 'Statuses', 'Created', 'Sold all time', 'Sold 365d', 'Sold 90d', 'Sold 30d', `Royalties all time ${currency}`, 'Last sale', 'ASINs'],
              ...rows.map((d) => [d.title, d.brand, d.listings.length, d.types.map((t) => PRODUCT_TYPES[t].short).join(' '), d.marketplaces.join(' '),
                (Object.entries(d.statuses) as Array<[Status, number]>).map(([s, n]) => `${n} ${STATUS_LABEL[s].toLowerCase()}`).join(', '), d.createdAt ?? '',
                Math.round(d.sold.all), Math.round(d.sold.y365), Math.round(d.sold.d90), Math.round(d.sold.d30), d.sold.royaltyAll.toFixed(2), d.lastSale ?? '',
                d.listings.map((l) => l.asin).filter(Boolean).join(' ')]),
            ]))
          }
        >
          <Download size={14} /> Export CSV
        </button>
      </PageHead>

      <FilterBar f={f} set={(next) => { setF(next); setPage(0); }} types={types} counts={counts} total={rows.length} noun="designs" />

      <div class="row wrap">
        <Seg<Period> label="Sold over" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => [p, PERIOD_LABEL[p]])} />
        <span class="muted small">Click a design to see each of its products.</span>
      </div>

      <Card pad={false}>
        <div class="table-wrap">
          <table class="table inventory">
            <thead>
              <tr>
                <th aria-label="Picture" />
                {head('title', 'Design', false)}
                {head('products', 'Products')}
                <th>Status</th>
                {head('created', 'Created')}
                {head('sold', `Sold · ${PERIOD_LABEL[period]}`)}
                {head('royalty', period === 'all' ? 'Royalties · all time' : 'Royalties · 365 days')}
                {head('lastSale', 'Last sale')}
              </tr>
            </thead>
            <tbody>
              {rows.slice(current * PAGE, (current + 1) * PAGE).map((d) => (
                <>
                  <tr class={open === d.key ? 'expanded' : ''} onClick={() => setOpen(open === d.key ? null : d.key)} style={{ cursor: 'pointer' }}>
                    <td><Preview listing={d.preview} size={60} /></td>
                    <td>
                      <div class="title-cell stack" style={{ gap: '2px' }}>
                        <span class="t" title={d.title}>{d.title || '—'}</span>
                        <span class="muted small">{d.brand}{d.brand ? ' · ' : ''}{d.types.map((t) => PRODUCT_TYPES[t].short).join(', ')}</span>
                      </div>
                    </td>
                    <td class="num nowrap">{d.listings.length} <span class="small">{d.marketplaces.map((m) => MARKETPLACES[m].flag).join('')}</span></td>
                    <td>
                      <div class="row wrap" style={{ gap: '4px' }}>
                        {(Object.entries(d.statuses) as Array<[Status, number]>).map(([s, n]) => <span class={`pill ${STATUS_TONE[s]}`}>{n} {STATUS_LABEL[s].toLowerCase()}</span>)}
                      </div>
                    </td>
                    <td class="num muted nowrap">{fmt.day(d.createdAt)}</td>
                    <td class="num">{d.sold[period] ? <b>{fmt.int(d.sold[period])}</b> : <span class="muted">0</span>}</td>
                    <td class="num">{fmt.money(period === 'all' ? d.sold.royaltyAll : d.sold.royalty365, currency)}</td>
                    <td class="num muted nowrap">{fmt.day(d.lastSale)}</td>
                  </tr>
                  {open === d.key && (
                    <tr class="expanded">
                      <td colSpan={8}><DesignDetail design={d} data={data} today={today} /></td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && <Pager page={current} pages={pages} total={rows.length} size={PAGE} onPage={setPage} />}
      </Card>
    </div>
  );
}

function DesignDetail({ design, data, today }: { design: DesignRow; data: Data; today: string }) {
  const range = { from: addDays(today, -89), to: today };
  const keys = new Set(design.listings.filter((l) => l.asin).map((l) => `${l.marketplace}:${l.asin}`));
  const rows = filterRows(data.sales, { range }).filter((r) => keys.has(`${r.marketplace}:${r.asin}`));
  const series = dailySeries(rows, range, data.settings.displayCurrency, data.settings.fx);
  return (
    <div class="stack" style={{ padding: '6px 0' }}>
      <div class="design-products">
        {design.listings.map((l) => (
          <div class="design-product">
            <Preview listing={l} fallback={design.preview} size={44} />
            <div class="stack" style={{ gap: '2px' }}>
              <span class="small"><b>{l.productType ? PRODUCT_TYPES[l.productType].label : 'Product'}</b> {l.marketplace ? MARKETPLACES[l.marketplace].flag : ''}</span>
              <span class="row" style={{ gap: '4px' }}>
                <span class={`pill ${STATUS_TONE[l.status]}`} title={l.rawStatus}>{STATUS_LABEL[l.status]}</span>
                <span class="small muted">{fmt.int(l.sold.all)} sold</span>
                {l.asin && l.marketplace && <a href={productUrl(l.marketplace, l.asin)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} title={l.asin}><External size={11} /></a>}
              </span>
            </div>
          </div>
        ))}
      </div>
      <ColumnChart
        height={140}
        ariaLabel={`Daily units for ${design.title}, last 90 days`}
        data={series.map((d) => ({ key: d.date, label: fmt.day(d.date), value: d.units, detail: `${fmt.day(d.date)} · ${fmt.money(d.royalty, data.settings.displayCurrency)}` }))}
        format={(n) => fmt.compact(n)}
      />
    </div>
  );
}
