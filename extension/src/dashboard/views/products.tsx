import { useMemo, useState } from 'preact/hooks';
import { dailySeries, filterRows, productSummaries, type ProductSummary } from '../../shared/analytics';
import { addDays, localDay, RANGE_LABELS, resolveRange, type RangeKey } from '../../shared/dates';
import * as fmt from '../../shared/format';
import { toCsv } from '../../shared/csv';
import { MARKETPLACES, productUrl, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPES, type ProductType } from '../../shared/products';
import { ColumnChart } from '../../ui/charts';
import { Card, Empty, Notice, Seg } from '../../ui/components';
import { Arrow, Box, Download, External, Search } from '../../ui/icons';
import type { Data } from '../data';
import { MarketplaceSelect, PageHead, ProductTypeSelect, usePersistent } from './common';
import { download } from './download';

type SortKey = 'units' | 'royalty' | 'velocity' | 'lastSale' | 'daysSinceSale';

export function Products({ data }: { data: Data }) {
  const { settings, sales } = data;
  const [rangeKey, setRangeKey] = usePersistent<RangeKey>('products-range', '90d');
  const [mp, setMp] = usePersistent<MarketplaceId | 'ALL'>('products-mp', 'ALL');
  const [type, setType] = usePersistent<ProductType | 'ALL'>('products-type', 'ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'units', desc: true });
  const [atRisk, setAtRisk] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const today = localDay();
  const currency = settings.displayCurrency;
  const limitDays = Math.round(settings.inactivityMonths * 30.4);
  const warnDays = limitDays - 60;

  const scope = useMemo(
    () => filterRows(sales, { range: { from: '0000-01-01', to: '9999-12-31' }, marketplaces: mp === 'ALL' ? undefined : [mp], productTypes: type === 'ALL' ? undefined : [type] }),
    [sales, mp, type],
  );
  const range = resolveRange(rangeKey, today, scope.reduce((m, r) => (r.date < m ? r.date : m), today));
  const summaries = useMemo(() => productSummaries(scope, range, today, currency, settings.fx), [scope, range.from, range.to, currency, settings.fx]);
  const risky = summaries.filter((s) => (s.daysSinceSale ?? 0) >= warnDays);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = summaries.filter((s) => !q || s.title.toLowerCase().includes(q) || s.asin.toLowerCase().includes(q));
    if (atRisk) list = list.filter((s) => (s.daysSinceSale ?? 0) >= warnDays);
    const value = (s: ProductSummary) => {
      const v = s[sort.key];
      return typeof v === 'string' ? Date.parse(v) : (v ?? -1);
    };
    return [...list].sort((a, b) => (sort.desc ? value(b) - value(a) : value(a) - value(b)));
  }, [summaries, query, sort, atRisk, warnDays]);

  if (!sales.length) {
    return (
      <div class="stack">
        <PageHead title="Products" />
        <Card><Empty icon={<Box size={22} />} title="No products yet"><p>Products appear here once Loupe has recorded sales.</p></Empty></Card>
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
      <PageHead title="Products" sub={`${summaries.length} designs with recorded sales`}>
        <button
          class="btn sm"
          onClick={() =>
            download(
              'loupe-products.csv',
              toCsv([
                ['ASIN', 'Marketplace', 'Title', 'Product type', `Units (${RANGE_LABELS[rangeKey]})`, `Royalties ${currency}`, 'Cancelled', 'Returned', 'First sale', 'Last sale', 'Days since sale', 'Units per day (30d)'],
                ...rows.map((s) => [s.asin, s.marketplace, s.title, s.productType ? PRODUCT_TYPES[s.productType].label : '', s.units, s.royalty.toFixed(2), s.cancelled, s.returned, s.firstSale ?? '', s.lastSale ?? '', s.daysSinceSale ?? '', s.velocity.toFixed(2)]),
              ]),
            )
          }
        >
          <Download size={14} /> Export CSV
        </button>
      </PageHead>

      {risky.length > 0 && (
        <Notice kind="warn">
          <b>{risky.length} designs</b> haven't sold in over {fmt.int(warnDays)} days. Merch removes listings without a sale for {settings.inactivityMonths} months.{' '}
          <button class="btn sm" style={{ marginLeft: '6px' }} onClick={() => setAtRisk(!atRisk)}>{atRisk ? 'Show all' : 'Show them'}</button>
        </Notice>
      )}

      <div class="filters">
        <Seg<RangeKey> label="Date range" value={rangeKey} onChange={setRangeKey} options={(['30d', '90d', 'year', 'all'] as RangeKey[]).map((r) => [r, RANGE_LABELS[r]])} />
        <MarketplaceSelect value={mp} onChange={setMp} all />
        <ProductTypeSelect value={type} onChange={setType} all />
        <div class="row" style={{ position: 'relative' }}>
          <Search size={14} class="muted" />
          <input class="input" style={{ width: '220px' }} placeholder="Search title or ASIN" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} aria-label="Search products" />
        </div>
      </div>

      <Card pad={false}>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Design</th>
                <th>Type</th>
                {header('units', 'Units')}
                {header('royalty', 'Royalties')}
                {header('velocity', 'Per day (30d)')}
                {header('lastSale', 'Last sale')}
                {header('daysSinceSale', 'Days idle')}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((s) => {
                const idle = s.daysSinceSale ?? 0;
                return (
                  <>
                    <tr class={open === s.key ? 'expanded' : ''} onClick={() => setOpen(open === s.key ? null : s.key)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div class="title-cell">
                          <span title={MARKETPLACES[s.marketplace].name}>{MARKETPLACES[s.marketplace].flag}</span>
                          <span class="t" title={s.title}>{s.title || s.asin}</span>
                        </div>
                      </td>
                      <td class="ink2 nowrap">{s.productType ? PRODUCT_TYPES[s.productType].short : '–'}</td>
                      <td class="num">{fmt.int(s.units)}</td>
                      <td class="num">{fmt.money(s.royalty, currency)}</td>
                      <td class="num">{s.velocity ? s.velocity.toFixed(2) : '–'}</td>
                      <td class="num muted">{fmt.day(s.lastSale)}</td>
                      <td class="num">
                        {idle >= warnDays ? <span class="pill warn">{idle}d</span> : <span class="muted">{s.daysSinceSale ?? '–'}</span>}
                      </td>
                    </tr>
                    {open === s.key && (
                      <tr class="expanded">
                        <td colSpan={7}>
                          <ProductDetail summary={s} data={data} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 500 && <div class="card-foot muted small">Showing the first 500 of {rows.length}. Narrow the filters or export CSV.</div>}
      </Card>
      <p class="muted small">Only designs with at least one recorded sale appear here. Royalties are converted to {currency}.</p>
    </div>
  );
}

function ProductDetail({ summary, data }: { summary: ProductSummary; data: Data }) {
  const today = localDay();
  const range = { from: addDays(today, -89), to: today };
  const rows = filterRows(data.sales, { range, marketplaces: [summary.marketplace], asin: summary.asin });
  const series = dailySeries(rows, range, data.settings.displayCurrency, data.settings.fx);
  return (
    <div class="stack" style={{ padding: '6px 0' }}>
      <div class="row wrap">
        <span class="muted small">{summary.asin} · first sale {fmt.day(summary.firstSale, 'long')} · {fmt.int(summary.cancelled)} cancelled · {fmt.int(summary.returned)} returned</span>
        <span class="grow" />
        <a class="btn sm" href={productUrl(summary.marketplace, summary.asin)} target="_blank" rel="noopener"><External size={13} /> Amazon</a>
      </div>
      <ColumnChart
        height={150}
        ariaLabel={`Daily units for ${summary.title || summary.asin}, last 90 days`}
        data={series.map((d) => ({ key: d.date, label: fmt.day(d.date), value: d.units, detail: `${fmt.day(d.date)} · ${fmt.money(d.royalty, data.settings.displayCurrency)}` }))}
        format={(n) => fmt.compact(n)}
      />
    </div>
  );
}
