// Products: every listing on Merch (one per product type and marketplace),
// with its status, when it was created, what it sold, and a picture.

import { useMemo, useState } from 'preact/hooks';
import { toCsv } from '../../shared/csv';
import * as fmt from '../../shared/format';
import { MARKETPLACES, productUrl } from '../../shared/marketplaces';
import { PRODUCT_TYPES, type ProductType } from '../../shared/products';
import { Card, Empty, Seg } from '../../ui/components';
import { Arrow, Download, External, Shirt } from '../../ui/icons';
import type { Data } from '../data';
import { PageHead, usePersistent } from './common';
import { download } from './download';
import {
  createdMatches, FilterBar, NO_FILTERS, PERIOD_LABEL, Preview, soldMatches, STATUS_LABEL, STATUS_TONE, useInventory,
  type Filters, type ListingRow, type Period, type Status,
} from './inventory';

type SortKey = 'title' | 'created' | 'sold' | 'price' | 'lastSale' | 'status';
const PAGE = 100;

export function Products({ data }: { data: Data }) {
  const { listings, designs, today } = useInventory(data);
  const [f, setF] = usePersistent<Filters>('products-filters', NO_FILTERS);
  const [period, setPeriod] = usePersistent<Period>('products-period', 'all');
  const [sort, setSort] = usePersistent<{ key: SortKey; desc: boolean }>('products-sort', { key: 'sold', desc: true });
  const [page, setPage] = useState(0);
  const designOf = useMemo(() => new Map(designs.map((d) => [d.key, d])), [designs]);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const list = listings.filter(
      (l) =>
        (!q || l.title.toLowerCase().includes(q) || l.brand.toLowerCase().includes(q) || (l.asin ?? '').toLowerCase().includes(q)) &&
        (f.mp === 'ALL' || l.marketplace === f.mp) &&
        (f.type === 'ALL' || l.productType === f.type) &&
        (f.status === 'ALL' || l.status === f.status) &&
        (f.searchable === 'any' || (f.searchable === 'yes' ? l.searchable === true : l.searchable === false)) &&
        createdMatches(l.createdAt, f, today) &&
        soldMatches(l.sold, f),
    );
    const value = (l: ListingRow): number | string => {
      switch (sort.key) {
        case 'title': return l.title.toLowerCase();
        case 'created': return l.createdAt ?? '';
        case 'price': return l.price ?? -1;
        case 'lastSale': return l.lastSale ?? '';
        case 'status': return STATUS_LABEL[l.status];
        default: return l.sold[period];
      }
    };
    return list.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -c : c;
    });
  }, [listings, f, sort, period, today]);

  const types = useMemo(() => Array.from(new Set(listings.map((l) => l.productType).filter((t): t is ProductType => t !== null))), [listings]);
  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const l of listings) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [listings]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, (current + 1) * PAGE);
  const soldInView = rows.reduce((n, l) => n + l.sold[period], 0);

  if (!listings.length) {
    return (
      <div class="stack">
        <PageHead title="Products" />
        <Card><Empty icon={<Shirt size={22} />} title="No products yet"><p>Sync your Merch account and every listing appears here with its status, sales and picture.</p></Empty></Card>
      </div>
    );
  }

  const head = (key: SortKey, text: string, num = false) => (
    <th class={num ? 'num' : ''} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => { setSort({ key, desc: sort.key === key ? !sort.desc : key !== 'title' }); setPage(0); }}>
        {text}
        {sort.key === key && <Arrow dir={sort.desc ? 'down' : 'up'} size={11} />}
      </button>
    </th>
  );

  return (
    <div class="stack">
      <PageHead title="Products" sub={`${fmt.int(counts.live ?? 0)} live of ${fmt.int(listings.length)} listings · one per product type and marketplace`}>
        <button
          class="btn sm"
          onClick={() =>
            download('loupe-products.csv', toCsv([
              ['Title', 'Brand', 'Marketplace', 'Product type', 'Status', 'Merch status', 'Created', 'ASIN', 'Price', 'Searchable', 'Sold all time', 'Sold 365d', 'Sold 90d', 'Sold 30d', 'Last sale'],
              ...rows.map((l) => [l.title, l.brand, l.marketplace ?? '', l.productType ? PRODUCT_TYPES[l.productType].label : '', STATUS_LABEL[l.status], l.rawStatus, l.createdAt ?? '', l.asin ?? '', l.price ?? '', l.searchable === null ? '' : l.searchable ? 'yes' : 'no', Math.round(l.sold.all), Math.round(l.sold.y365), Math.round(l.sold.d90), Math.round(l.sold.d30), l.lastSale ?? '']),
            ]))
          }
        >
          <Download size={14} /> Export CSV
        </button>
      </PageHead>

      <FilterBar f={f} set={(next) => { setF(next); setPage(0); }} types={types} counts={counts} total={rows.length} noun="products" />

      <div class="row wrap">
        <Seg<Period> label="Sold over" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => [p, PERIOD_LABEL[p]])} />
        <span class="muted small">{fmt.int(soldInView)} units sold by these products · {PERIOD_LABEL[period].toLowerCase()}</span>
      </div>

      <Card pad={false}>
        <div class="table-wrap">
          <table class="table inventory">
            <thead>
              <tr>
                <th aria-label="Picture" />
                {head('title', 'Product')}
                <th>Market</th>
                <th>Type</th>
                {head('status', 'Status')}
                {head('created', 'Created', true)}
                <th>ASIN</th>
                {head('price', 'Price', true)}
                {head('sold', `Sold · ${PERIOD_LABEL[period]}`, true)}
                {head('lastSale', 'Last sale', true)}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr>
                  <td><Preview listing={l} fallback={designOf.get(l.designKey)?.preview} /></td>
                  <td>
                    <div class="title-cell stack" style={{ gap: '2px' }}>
                      <span class="t" title={l.title}>{l.title || '—'}</span>
                      {l.brand && <span class="muted small">{l.brand}</span>}
                    </div>
                  </td>
                  <td class="nowrap">{l.marketplace ? `${MARKETPLACES[l.marketplace].flag} ${l.marketplace}` : '—'}</td>
                  <td class="small nowrap">{l.productType ? PRODUCT_TYPES[l.productType].label : '—'}</td>
                  <td><span class={`pill ${STATUS_TONE[l.status]}`} title={l.rawStatus}>{STATUS_LABEL[l.status]}</span>{l.searchable === false && l.status === 'live' && <span class="pill warn" title="Merch says shoppers can't find it on Amazon">not searchable</span>}</td>
                  <td class="num muted nowrap">{fmt.day(l.createdAt)}</td>
                  <td class="nowrap small">
                    {l.asin && l.marketplace ? (
                      <a href={productUrl(l.marketplace, l.asin)} target="_blank" rel="noopener">{l.asin} <External size={11} /></a>
                    ) : <span class="muted">—</span>}
                  </td>
                  <td class="num">{l.price !== null && l.marketplace ? fmt.money(l.price, MARKETPLACES[l.marketplace].currency) : '—'}</td>
                  <td class="num">{l.sold[period] ? <b>{fmt.int(l.sold[period])}</b> : <span class="muted">0</span>}</td>
                  <td class="num muted nowrap">{fmt.day(l.lastSale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && <Pager page={current} pages={pages} total={rows.length} size={PAGE} onPage={setPage} />}
      </Card>
    </div>
  );
}

export function Pager({ page, pages, total, size, onPage }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void }) {
  return (
    <div class="card-foot row">
      <span class="muted small grow">{fmt.int(page * size + 1)}–{fmt.int(Math.min(total, (page + 1) * size))} of {fmt.int(total)}</span>
      <button class="btn sm" disabled={page === 0} onClick={() => onPage(0)}>First</button>
      <button class="btn sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
      <span class="small">Page {page + 1} of {pages}</span>
      <button class="btn sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
      <button class="btn sm" disabled={page >= pages - 1} onClick={() => onPage(pages - 1)}>Last</button>
    </div>
  );
}
