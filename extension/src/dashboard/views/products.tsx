import { useMemo, useState } from 'preact/hooks';
import type { Design } from '../../shared/agent';
import { addDays, pacificDay } from '../../shared/dates';
import { dailySeries, filterRows } from '../../shared/analytics';
import { toCsv } from '../../shared/csv';
import * as fmt from '../../shared/format';
import { MARKETPLACES, productUrl } from '../../shared/marketplaces';
import { PRODUCT_TYPES } from '../../shared/products';
import { ColumnChart } from '../../ui/charts';
import { Card, Empty, Notice, Seg } from '../../ui/components';
import { Arrow, Box, Download, External, Search } from '../../ui/icons';
import type { Data } from '../data';
import { usePortfolio } from './agent';
import { PageHead } from './common';
import { download } from './download';

type SortKey = 'u30' | 'u90' | 'u365' | 'r90' | 'lastSale' | 'ageDays';
type Show = 'live' | 'sold' | 'never' | 'all';

export function Products({ data }: { data: Data }) {
  const p = usePortfolio(data);
  const currency = data.settings.displayCurrency;
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('live');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'u90', desc: true });
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(300);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = p.designs.filter((d) => !q || d.title.toLowerCase().includes(q) || d.products.some((x) => x.asin?.toLowerCase().includes(q)));
    if (show === 'live') list = list.filter((d) => d.live);
    if (show === 'sold') list = list.filter((d) => d.u365 > 0);
    if (show === 'never') list = list.filter((d) => d.live && d.u365 === 0);
    const value = (d: Design) => {
      const v = d[sort.key];
      return typeof v === 'string' ? Date.parse(v) : (v ?? -1);
    };
    return [...list].sort((a, b) => (sort.desc ? value(b) - value(a) : value(a) - value(b)));
  }, [p, query, show, sort]);

  if (!p.designs.length) {
    return (
      <div class="stack">
        <PageHead title="Designs" />
        <Card><Empty icon={<Box size={22} />} title="No designs yet"><p>Connect your Merch account and your designs appear here, including the ones that never sold.</p></Empty></Card>
      </div>
    );
  }

  const header = (key: SortKey, text: string) => (
    <th class="num" aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : true })}>
        {text}
        {sort.key === key && <Arrow dir={sort.desc ? 'down' : 'up'} size={11} />}
      </button>
    </th>
  );

  return (
    <div class="stack">
      <PageHead title="Designs" sub={`${fmt.int(p.liveDesigns)} live designs${p.catalogKnown ? ` · ${fmt.int(p.liveProducts)} live products` : ''} · grouped across product types and marketplaces`}>
        <button
          class="btn sm"
          onClick={() =>
            download('loupe-designs.csv', toCsv([
              ['Design', 'Brand', 'Live', 'Product types', 'Marketplaces', 'Units 30d', 'Units 90d', 'Units 365d', `Royalties 90d ${currency}`, `Royalties 365d ${currency}`, 'Returns 365d', 'Last sale', 'Created', 'ASINs'],
              ...rows.map((d) => [d.title, d.brand, d.live ? 'yes' : 'no', d.types.map((t) => PRODUCT_TYPES[t].short).join(' '), d.marketplaces.join(' '), d.u30, d.u90, d.u365, d.r90.toFixed(2), d.r365.toFixed(2), d.returns365, d.lastSale ?? '', d.createdAt ?? '', d.products.map((x) => x.asin).filter(Boolean).join(' ')]),
            ]))
          }
        >
          <Download size={14} /> Export CSV
        </button>
      </PageHead>

      {!p.catalogKnown && <Notice kind="warn">Only designs with sales are listed until Loupe reads your product list on Merch. Use Sync now on the Agent page.</Notice>}

      <div class="filters">
        <Seg<Show> label="Show" value={show} onChange={setShow} options={[['live', 'Live'], ['sold', 'Sold this year'], ['never', 'No sales this year'], ['all', 'All']]} />
        <div class="row">
          <Search size={14} class="muted" />
          <input class="input" style={{ width: '240px' }} placeholder="Search title or ASIN" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="Search designs" />
        </div>
        <span class="muted small">{fmt.int(rows.length)} designs</span>
      </div>

      <Card pad={false}>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Design</th>
                <th>Products</th>
                {header('u30', '30d')}
                {header('u90', '90d')}
                {header('u365', '365d')}
                {header('r90', 'Royalties 90d')}
                {header('lastSale', 'Last sale')}
                {header('ageDays', 'Age')}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((d) => {
                const first = d.products.find((x) => x.asin && x.marketplace);
                return (
                  <>
                    <tr class={open === d.key ? 'expanded' : ''} onClick={() => setOpen(open === d.key ? null : d.key)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div class="title-cell">
                          <span class="t" title={d.title}>{d.title || first?.asin}</span>
                          {!d.live && <span class="pill neutral">not live</span>}
                        </div>
                      </td>
                      <td class="small ink2 nowrap">{d.types.map((t) => PRODUCT_TYPES[t].short).join(', ') || '–'} {d.marketplaces.map((m) => MARKETPLACES[m].flag).join('')}</td>
                      <td class="num">{fmt.int(d.u30)}</td>
                      <td class="num">{fmt.int(d.u90)}</td>
                      <td class="num">{d.u365 ? fmt.int(d.u365) : <span class="pill warn">0</span>}</td>
                      <td class="num">{fmt.money(d.r90, currency)}</td>
                      <td class="num muted">{fmt.day(d.lastSale)}</td>
                      <td class="num muted">{fmt.age(d.ageDays)}</td>
                    </tr>
                    {open === d.key && (
                      <tr class="expanded">
                        <td colSpan={8}><DesignDetail design={d} data={data} /></td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div class="card-foot row">
            <span class="muted small grow">Showing {fmt.int(limit)} of {fmt.int(rows.length)}.</span>
            <button class="btn sm" onClick={() => setLimit(limit + 300)}>Show more</button>
          </div>
        )}
      </Card>
    </div>
  );
}

function DesignDetail({ design, data }: { design: Design; data: Data }) {
  const today = pacificDay(Date.now());
  const range = { from: addDays(today, -89), to: today };
  const keys = new Set(design.products.map((p) => p.key));
  const rows = filterRows(data.sales, { range }).filter((r) => keys.has(`${r.marketplace}:${r.asin}`));
  const series = dailySeries(rows, range, data.settings.displayCurrency, data.settings.fx);
  return (
    <div class="stack" style={{ padding: '6px 0' }}>
      <div class="chips">
        {design.products.map((p) => (
          <span class="chip" title={p.status}>
            {p.marketplace ? MARKETPLACES[p.marketplace].flag : ''} {p.productType ? PRODUCT_TYPES[p.productType].short : 'Product'} · {fmt.int(p.u90)} in 90d
            {p.asin && p.marketplace && <a href={productUrl(p.marketplace, p.asin)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><External size={11} /></a>}
          </span>
        ))}
      </div>
      <ColumnChart
        height={150}
        ariaLabel={`Daily units for ${design.title}, last 90 days`}
        data={series.map((d) => ({ key: d.date, label: fmt.day(d.date), value: d.units, detail: `${fmt.day(d.date)} · ${fmt.money(d.royalty, data.settings.displayCurrency)}` }))}
        format={(n) => fmt.compact(n)}
      />
    </div>
  );
}
