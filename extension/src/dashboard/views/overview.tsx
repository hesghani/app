import { useMemo, useState } from 'preact/hooks';
import {
  breakdown, bucketSeries, dailySeries, filterRows, percentChange, productSummaries, totals,
} from '../../shared/analytics';
import { daysBetween, localDay, previousRange, RANGE_LABELS, resolveRange, type RangeKey } from '../../shared/dates';
import * as fmt from '../../shared/format';
import { MARKETPLACES, productUrl, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPES, type ProductType } from '../../shared/products';
import { BarList, ColumnChart, DataTable } from '../../ui/charts';
import { Card, Notice, Seg, StatTile } from '../../ui/components';
import { External } from '../../ui/icons';
import { ConnectCard, startSync } from './connect';
import { navigate, type Data } from '../data';
import { MarketplaceSelect, PageHead, ProductTypeSelect, usePersistent } from './common';
import { Welcome } from './welcome';

const RANGES: RangeKey[] = ['today', 'yesterday', '7d', '30d', '90d', 'month', 'lastMonth', 'year', 'all'];
const SHORT: Partial<Record<RangeKey, string>> = { '7d': '7D', '30d': '30D', '90d': '90D', month: 'MTD', lastMonth: 'Last month', year: 'YTD', all: 'All' };

export function Overview({ data }: { data: Data }) {
  const { settings, sales, meta } = data;
  const [rangeKey, setRangeKey] = usePersistent<RangeKey>('range', '30d');
  const [mp, setMp] = usePersistent<MarketplaceId | 'ALL'>('overview-mp', 'ALL');
  const [type, setType] = usePersistent<ProductType | 'ALL'>('overview-type', 'ALL');
  const [metric, setMetric] = usePersistent<'units' | 'royalty'>('metric', 'units');
  const [showTable, setShowTable] = useState(false);
  const currency = settings.displayCurrency;
  const fx = settings.fx;
  const today = localDay();

  const view = useMemo(() => {
    const earliest = sales.reduce((min, r) => (r.date < min ? r.date : min), today);
    const range = resolveRange(rangeKey, today, earliest);
    const prev = previousRange(range);
    const scope = filterRows(sales, {
      range: { from: '0000-01-01', to: '9999-12-31' },
      marketplaces: mp === 'ALL' ? undefined : [mp],
      productTypes: type === 'ALL' ? undefined : [type],
    });
    const current = filterRows(scope, { range });
    const before = filterRows(scope, { range: prev });
    const t = totals(current, currency, fx);
    const p = totals(before, currency, fx);
    const days = daysBetween(range.from, range.to) + 1;
    const bucket: 'day' | 'week' | 'month' = days <= 92 ? 'day' : days <= 400 ? 'week' : 'month';
    const series = bucketSeries(dailySeries(current, range, currency, fx), bucket);
    return {
      range, t, p, bucket,
      series,
      byMarket: breakdown(current, (r) => r.marketplace, currency, fx),
      byType: breakdown(current, (r) => r.productType ?? 'UNKNOWN', currency, fx),
      top: productSummaries(scope, range, today, currency, fx).filter((s) => s.units > 0).slice(0, 10),
    };
  }, [sales, rangeKey, mp, type, currency, fx, today]);

  if (!sales.length) {
    return (
      <div class="stack">
        <PageHead title="Overview" sub="Your Merch on Demand sales at a glance" />
        {data.syncState.status !== 'idle' && <ConnectCard data={data} />}
        <Welcome settings={settings} compact />
      </div>
    );
  }

  const { t, p } = view;
  const comparable = rangeKey !== 'all';
  const vs = rangeKey === 'today' ? 'yesterday' : rangeKey === 'yesterday' ? 'day before' : 'previous period';
  const money = (n: number) => fmt.money(n, currency);
  const label = (date: string) => {
    if (view.bucket === 'month') return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    return fmt.day(date);
  };

  return (
    <div class="stack">
      <PageHead title="Overview" sub={`${RANGE_LABELS[rangeKey]} · ${fmt.day(view.range.from, 'long')} – ${fmt.day(view.range.to, 'long')}`} />

      {meta.demo ? (
        <Notice>
          You're looking at <b>sample data</b>. <button class="btn sm" onClick={() => void startSync('connect')}>Connect your Merch account</button> and your real sales replace it.
        </Notice>
      ) : (
        <ConnectCard data={data} compact />
      )}

      <div class="filters">
        <Seg<RangeKey> label="Date range" value={rangeKey} onChange={setRangeKey} options={RANGES.map((r) => [r, SHORT[r] ?? RANGE_LABELS[r]])} />
        <MarketplaceSelect value={mp} onChange={setMp} all />
        <ProductTypeSelect value={type} onChange={setType} all />
      </div>

      <div class="grid-4">
        <StatTile label="Units sold" value={fmt.int(t.units)} delta={comparable ? percentChange(t.units, p.units) : undefined} vs={vs} />
        <StatTile label="Royalties" value={money(t.royalty)} delta={comparable ? percentChange(t.royalty, p.royalty) : undefined} vs={vs} hint="Converted with the exchange rates in Settings" />
        <StatTile label="Royalty per unit" value={t.units ? money(t.perUnit) : '–'} delta={comparable && p.units ? percentChange(t.perUnit, p.perUnit) : undefined} vs={vs} />
        <StatTile
          label="Designs that sold"
          value={fmt.int(t.asins)}
          delta={comparable ? percentChange(t.asins, p.asins) : undefined}
          vs={vs}
          hint={`${fmt.int(t.cancelled)} cancelled, ${fmt.int(t.returned)} returned in this range`}
        />
      </div>

      <Card
        title={metric === 'units' ? `Units sold per ${view.bucket}` : `Royalties per ${view.bucket} (${currency})`}
        actions={
          <>
            <Seg<'units' | 'royalty'> label="Metric" value={metric} onChange={setMetric} options={[['units', 'Units'], ['royalty', 'Royalties']]} />
            <button class="btn sm" aria-pressed={showTable ? 'true' : 'false'} onClick={() => setShowTable(!showTable)}>Table</button>
          </>
        }
      >
        {showTable ? (
          <DataTable
            columns={[view.bucket === 'day' ? 'Date' : view.bucket === 'week' ? 'Week of' : 'Month', 'Units', `Royalties (${currency})`]}
            rows={[...view.series].reverse().map((d) => [label(d.date), fmt.int(d.units), money(d.royalty)])}
          />
        ) : (
          <ColumnChart
            ariaLabel={metric === 'units' ? 'Units sold over time' : 'Royalties over time'}
            data={view.series.map((d) => ({
              key: d.date,
              label: label(d.date),
              value: metric === 'units' ? d.units : d.royalty,
              detail: `${view.bucket === 'week' ? 'Week of ' : ''}${label(d.date)} · ${metric === 'units' ? money(d.royalty) : `${fmt.int(d.units)} units`}`,
            }))}
            format={metric === 'units' ? (n) => fmt.compact(n) : (n) => (currency === 'JPY' ? fmt.compact(n) : `${fmt.money(n, currency, { compact: true }).replace(/\.00$/, '')}`)}
          />
        )}
      </Card>

      <div class="grid-2">
        <Card title="By marketplace">
          <BarList
            items={view.byMarket.map((b) => ({
              key: b.key,
              label: `${MARKETPLACES[b.key as MarketplaceId].flag} ${MARKETPLACES[b.key as MarketplaceId].name}`,
              value: metric === 'units' ? b.units : b.royalty,
              display: metric === 'units' ? fmt.int(b.units) : money(b.royalty),
              sub: fmt.pct(b.share),
            }))}
          />
        </Card>
        <Card title="By product type">
          <BarList
            items={view.byType.slice(0, 8).map((b) => ({
              key: b.key,
              label: b.key === 'UNKNOWN' ? 'Unknown' : PRODUCT_TYPES[b.key as ProductType].label,
              value: metric === 'units' ? b.units : b.royalty,
              display: metric === 'units' ? fmt.int(b.units) : money(b.royalty),
              sub: fmt.pct(b.share),
            }))}
          />
        </Card>
      </div>

      <Card title="Top designs" actions={<button class="btn sm ghost" onClick={() => navigate('products')}>All products</button>} pad={false}>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Design</th>
                <th>Type</th>
                <th class="num">Units</th>
                <th class="num">Royalties</th>
                <th class="num">Last sale</th>
              </tr>
            </thead>
            <tbody>
              {view.top.map((s) => (
                <tr>
                  <td>
                    <div class="title-cell">
                      <span>{MARKETPLACES[s.marketplace].flag}</span>
                      <a class="t" href={productUrl(s.marketplace, s.asin)} target="_blank" rel="noopener" title={s.title || s.asin}>
                        {s.title || s.asin}
                      </a>
                      <External size={12} class="muted" />
                    </div>
                  </td>
                  <td class="ink2 nowrap">{s.productType ? PRODUCT_TYPES[s.productType].short : '–'}</td>
                  <td class="num">{fmt.int(s.units)}</td>
                  <td class="num">{money(s.royalty)}</td>
                  <td class="num muted">{fmt.day(s.lastSale)}</td>
                </tr>
              ))}
              {!view.top.length && (
                <tr><td colSpan={5} class="muted">No sales in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
