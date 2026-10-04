import { useMemo, useState } from 'preact/hooks';
import * as fmt from '../../shared/format';
import { MARKETPLACES, type MarketplaceId } from '../../shared/marketplaces';
import { defaultPrice, PRODUCT_TYPES, PRODUCT_TYPE_IDS, type ProductType } from '../../shared/products';
import {
  breakEvenPrice, calibrateCost, productionCost, royaltyAllTiers, TIER_LABELS, type RoyaltyTier,
} from '../../shared/royalty';
import { saveSettings } from '../../shared/storage';
import { Card, Notice, NumberInput, Seg, useToast } from '../../ui/components';
import type { Data } from '../data';
import { MarketplaceSelect, PageHead, ProductTypeSelect } from './common';

const TIERS: RoyaltyTier[] = ['creator', 'plus', 'premium'];

export function Royalties({ data }: { data: Data }) {
  const { settings } = data;
  const model = settings.royalty;
  const toast = useToast();
  const [type, setType] = useState<ProductType>('STANDARD_TSHIRT');
  const [mp, setMp] = useState<MarketplaceId>(settings.marketplace);
  const [price, setPrice] = useState(defaultPrice('STANDARD_TSHIRT', settings.marketplace));
  const [goal, setGoal] = useState(1000);
  const [observed, setObserved] = useState(0);
  const [observedTier, setObservedTier] = useState<RoyaltyTier>(settings.royaltyTier);
  const currency = MARKETPLACES[mp].currency;
  const money = (n: number) => fmt.money(n, currency);

  const r = royaltyAllTiers(model, type, mp, price);
  const floor = breakEvenPrice(model, type, mp);
  const step = currency === 'JPY' ? 200 : 1;
  const ladder = useMemo(() => {
    const start = currency === 'JPY' ? Math.ceil(floor / 100) * 100 - 20 : Math.ceil(floor) - 0.01;
    return Array.from({ length: 10 }, (_, i) => Math.round((start + i * step) * 100) / 100).filter((p) => p > floor);
  }, [floor, step, currency]);

  return (
    <div class="stack">
      <PageHead title="Royalties" sub="Estimate royalties for every product, marketplace and tier, and find your price floor" />
      <Notice>
        Since June 2026 Merch pays one of three tiers based on where your traffic comes from: <b>Creator</b> (default, Amazon-organic), <b>Plus</b> (≈2×) and <b>Premium</b> (≈2.16×).
        These are estimates. Check one product against Merch's live royalty display and calibrate below for exact numbers.
      </Notice>

      <div class="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Calculator">
          <div class="stack">
            <div class="row wrap">
              <ProductTypeSelect value={type} onChange={(t) => { setType(t as ProductType); setPrice(defaultPrice(t as ProductType, mp)); }} />
              <MarketplaceSelect value={mp} onChange={(m) => { setMp(m as MarketplaceId); setPrice(defaultPrice(type, m as MarketplaceId)); }} />
            </div>
            <label class="field" style={{ maxWidth: '200px' }}>
              <span>List price ({currency})</span>
              <NumberInput value={price} step={currency === 'JPY' ? 100 : 0.5} min={0} onChange={setPrice} />
            </label>
            <div class="grid-3">
              {TIERS.map((tier) => (
                <div class="card stat" style={tier === settings.royaltyTier ? { borderColor: 'var(--brand-line)', background: 'var(--brand-soft)' } : undefined}>
                  <div class="label">{TIER_LABELS[tier]}{tier === settings.royaltyTier ? ' · yours' : ''}</div>
                  <div class="value">{money(r[tier])}</div>
                  <div class="delta"><span class="vs">{r[tier] > 0 ? `${fmt.int(Math.ceil(goal / Math.max(0.01, r[tier])))} sales for ${money(goal)}` : 'Below the price floor'}</span></div>
                </div>
              ))}
            </div>
            <dl class="kv">
              <dt>Price floor</dt><dd>{money(floor)} (royalty reaches zero)</dd>
              <dt>Production cost</dt><dd>{money(productionCost(model, type, mp))}{model.costOverrides[type]?.[mp] !== undefined ? ' · calibrated' : ' · estimate'}</dd>
              <dt>VAT in price</dt><dd>{fmt.pct(MARKETPLACES[mp].vat)}</dd>
              <dt>Referral fee</dt><dd>{fmt.pct(model.referralRate)}</dd>
            </dl>
            <label class="field" style={{ maxWidth: '220px' }}>
              <span>Monthly royalty goal ({currency})</span>
              <NumberInput value={goal} step={100} min={0} onChange={setGoal} />
            </label>
          </div>
        </Card>

        <Card title="Price ladder" pad={false}>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Price</th>{TIERS.map((t) => <th class="num">{TIER_LABELS[t]}</th>)}<th class="num">Sales for goal ({TIER_LABELS[settings.royaltyTier]})</th></tr>
              </thead>
              <tbody>
                {ladder.map((p) => {
                  const row = royaltyAllTiers(model, type, mp, p);
                  const mine = row[settings.royaltyTier];
                  return (
                    <tr class={Math.abs(p - price) < 0.01 ? 'expanded' : ''} style={{ cursor: 'pointer' }} onClick={() => setPrice(p)}>
                      <td class="num" style={{ textAlign: 'left' }}>{money(p)}</td>
                      {TIERS.map((t) => <td class="num">{money(row[t])}</td>)}
                      <td class="num">{mine > 0 ? fmt.int(Math.ceil(goal / mine)) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Calibrate from Merch">
        <p class="muted small" style={{ marginBottom: '12px' }}>
          On Merch's create page, set a price and read the royalty it shows. Enter both here and Loupe solves for the production cost of{' '}
          <b>{PRODUCT_TYPES[type].label}</b> on <b>{MARKETPLACES[mp].name}</b>, so every estimate for it becomes exact.
        </p>
        <div class="row wrap" style={{ alignItems: 'flex-end' }}>
          <label class="field" style={{ width: '160px' }}><span>Price on Merch</span><NumberInput value={price} step={0.5} onChange={setPrice} /></label>
          <label class="field" style={{ width: '160px' }}><span>Royalty shown</span><NumberInput value={observed} step={0.01} onChange={setObserved} /></label>
          <label class="field"><span>Your tier on Merch</span>
            <Seg<RoyaltyTier> label="Tier" value={observedTier} onChange={setObservedTier} options={TIERS.map((t) => [t, TIER_LABELS[t]])} />
          </label>
          <button
            class="btn primary"
            disabled={observed <= 0}
            onClick={async () => {
              const cost = calibrateCost(model, mp, price, observedTier, observed);
              const overrides = { ...model.costOverrides, [type]: { ...(model.costOverrides[type] ?? {}), [mp]: cost } };
              await saveSettings({ royalty: { ...model, costOverrides: overrides }, royaltyTier: observedTier });
              toast(`Calibrated ${PRODUCT_TYPES[type].short} on ${mp}: cost ${money(cost)}`);
            }}
          >
            Calibrate
          </button>
          {model.costOverrides[type]?.[mp] !== undefined && (
            <button
              class="btn ghost"
              onClick={async () => {
                const forType = { ...(model.costOverrides[type] ?? {}) };
                delete forType[mp];
                await saveSettings({ royalty: { ...model, costOverrides: { ...model.costOverrides, [type]: forType } } });
                toast('Reset to the default estimate');
              }}
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      <Card title="All products at their typical price" pad={false}>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Product</th><th class="num">Price</th>{TIERS.map((t) => <th class="num">{TIER_LABELS[t]}</th>)}<th class="num">Floor</th></tr></thead>
            <tbody>
              {PRODUCT_TYPE_IDS.map((t) => {
                const p = defaultPrice(t, mp);
                const row = royaltyAllTiers(model, t, mp, p);
                return (
                  <tr>
                    <td>{PRODUCT_TYPES[t].label}</td>
                    <td class="num">{money(p)}</td>
                    {TIERS.map((tier) => <td class="num">{money(row[tier])}</td>)}
                    <td class="num muted">{money(breakEvenPrice(model, t, mp))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
