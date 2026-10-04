import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatMonthly, heat, HEAT_LABELS, salesPerMonth } from '../../shared/bsr';
import { ageInDays } from '../../shared/dates';
import * as fmt from '../../shared/format';
import { MARKETPLACES, productUrl, type MarketplaceId } from '../../shared/marketplaces';
import { PRODUCT_TYPES } from '../../shared/products';
import { fetchProduct } from '../../shared/research';
import { productKey, saveProduct, setTracked } from '../../shared/storage';
import type { StoredProduct } from '../../shared/types';
import { Card, Empty, useToast } from '../../ui/components';
import { Arrow, External, Plus, Refresh, Star, Trash } from '../../ui/icons';
import { BsrSparkline } from '../../ui/sparkline';
import type { Data, Route } from '../data';
import { amazonImage, MarketplaceSelect, PageHead } from './common';

/** BSR change over roughly the last week, as a ratio (negative = rank improved). */
function weekChange(p: StoredProduct): number | null {
  if (p.history.length < 2 || !p.bsr) return null;
  const cutoff = Date.now() - 7 * 86_400_000;
  const past = [...p.history].reverse().find(([t]) => t <= cutoff) ?? p.history[0]!;
  if (past[0] === p.history[p.history.length - 1]![0]) return null;
  return (p.bsr - past[1]) / past[1];
}

export function Watchlist({ data, route }: { data: Data; route: Route }) {
  const toast = useToast();
  const [asin, setAsin] = useState('');
  const [mp, setMp] = useState<MarketplaceId>(data.settings.marketplace);
  const [busy, setBusy] = useState(false);
  const focus = route.params.get('asin');
  const tracked = useMemo(
    () => data.products.filter((p) => p.tracked).sort((a, b) => (a.bsr ?? Infinity) - (b.bsr ?? Infinity)),
    [data.products],
  );

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`w-${route.params.get('mp') ?? ''}-${focus}`);
    el?.scrollIntoView({ block: 'center' });
  }, [focus, tracked.length]);

  const add = async (e: Event) => {
    e.preventDefault();
    const id = asin.trim().toUpperCase().match(/[A-Z0-9]{10}/)?.[0];
    if (!id) {
      toast('Enter a 10-character ASIN or paste a product link');
      return;
    }
    setBusy(true);
    try {
      const product = await fetchProduct(mp, id);
      await saveProduct(product);
      await setTracked(mp, id, true, product);
      toast(`Tracking ${product.title || id}`);
      setAsin('');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="stack">
      <PageHead title="Watchlist" sub={`BSR history for products you track · refreshed every ${data.settings.watchRefreshHours}h · last run ${fmt.ago(data.meta.lastWatchRefresh)}`}>
        <button
          class="btn sm"
          disabled={!tracked.length || busy}
          onClick={async () => {
            setBusy(true);
            const res = (await chrome.runtime.sendMessage({ type: 'watchlist:refresh', keys: tracked.map((p) => productKey(p.marketplace, p.asin)) })) as { refreshed?: number; failed?: number; error?: string };
            setBusy(false);
            toast(res?.error ?? `Refreshed ${res?.refreshed ?? 0}${res?.failed ? `, ${res.failed} failed` : ''}`);
          }}
        >
          <Refresh size={14} /> Refresh all
        </button>
      </PageHead>

      <Card>
        <form class="row wrap" onSubmit={add}>
          <input class="input grow" style={{ minWidth: '240px' }} placeholder="ASIN or Amazon product link (yours or a competitor's)" value={asin} onInput={(e) => setAsin((e.target as HTMLInputElement).value)} aria-label="ASIN" />
          <MarketplaceSelect value={mp} onChange={(v) => setMp(v as MarketplaceId)} />
          <button class="btn primary" type="submit" disabled={busy}><Plus size={15} /> Track</button>
        </form>
      </Card>

      {tracked.length ? (
        <Card pad={false}>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="num">BSR</th>
                  <th class="num">7-day change</th>
                  <th style={{ width: '200px' }}>History</th>
                  <th class="num">Est. sales</th>
                  <th class="num">Price</th>
                  <th class="num">Reviews</th>
                  <th class="num">Age</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tracked.map((p) => {
                  const change = weekChange(p);
                  const h = heat(p.bsr, data.settings.heat);
                  const rowId = `w-${p.marketplace}-${p.asin}`;
                  return (
                    <tr id={rowId} class={focus === p.asin ? 'expanded' : ''}>
                      <td>
                        <div class="title-cell">
                          {p.image ? <img class="thumb" src={amazonImage(p.image)} alt="" loading="lazy" /> : <span class="thumb" />}
                          <div style={{ minWidth: 0 }}>
                            <a class="t" style={{ display: 'block' }} href={productUrl(p.marketplace, p.asin)} target="_blank" rel="noopener" title={p.title}>{p.title || p.asin}</a>
                            <span class="muted small">
                              {MARKETPLACES[p.marketplace].flag} {p.asin}
                              {p.productType ? ` · ${PRODUCT_TYPES[p.productType].short}` : ''} · checked {fmt.ago(p.fetchedAt)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td class="num nowrap" title={HEAT_LABELS[h]}><span class={`dot heat-${h}`} /> {fmt.bsr(p.bsr)}</td>
                      <td class="num nowrap">
                        {change === null ? <span class="muted">–</span> : (
                          <span class={change < 0 ? 'pill good' : change > 0 ? 'pill bad' : 'pill neutral'} title={change < 0 ? 'Rank improved' : 'Rank dropped'}>
                            <Arrow dir={change < 0 ? 'up' : 'down'} size={11} />
                            {Math.abs(Math.round(change * 100))}%
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--series)' }}>
                        {p.history.length >= 2 ? <BsrSparkline points={p.history} width={200} height={40} /> : <span class="muted small">Building history…</span>}
                      </td>
                      <td class="num">{formatMonthly(salesPerMonth(p.bsr, p.marketplace))}</td>
                      <td class="num">{p.price ? fmt.money(p.price, p.currency) : '–'}</td>
                      <td class="num">{fmt.int(p.reviews ?? 0)}</td>
                      <td class="num">{fmt.age(ageInDays(p.firstAvailable))}</td>
                      <td class="num nowrap">
                        <a class="btn sm icon ghost" href={productUrl(p.marketplace, p.asin)} target="_blank" rel="noopener" title="Open on Amazon"><External size={13} /></a>
                        <button class="btn sm icon ghost" title="Stop tracking" onClick={() => void setTracked(p.marketplace, p.asin, false)}><Trash size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <Empty icon={<Star size={22} />} title="Track products to see their BSR over time">
            <p>Click the star on any Amazon search result or product page, or add an ASIN above. Loupe re-checks tracked products in the background.</p>
          </Empty>
        </Card>
      )}
    </div>
  );
}
