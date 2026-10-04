// Product page panel: BSR, sales estimate, age, royalty at this price,
// keywords and a trademark check, docked in the corner of the page.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatMonthly, heat, HEAT_LABELS, salesPerDay, salesPerMonth } from '../../shared/bsr';
import { ageInDays } from '../../shared/dates';
import * as fmt from '../../shared/format';
import { extractKeywords, isStockBullet } from '../../shared/keywords';
import { MARKETPLACES, merchSearchUrl, type MarketplaceId } from '../../shared/marketplaces';
import { parseAsinFromUrl, parseProductDocument } from '../../shared/parse-product';
import { PRODUCT_TYPES } from '../../shared/products';
import { royaltyAllTiers, TIER_LABELS, type RoyaltyTier } from '../../shared/royalty';
import type { Settings } from '../../shared/settings';
import { getProduct, saveProduct, setTracked } from '../../shared/storage';
import { phrasesToCheck, scanText, tmviewUrl, usptoUrl } from '../../shared/trademark';
import type { StoredProduct } from '../../shared/types';
import { Alert, ChevronDown, ChevronUp, Copy, External, Logo, Search, Shield, Star } from '../../ui/icons';
import { BsrSparkline } from '../../ui/sparkline';
import { copyText, mount, type Mounted } from '../shared/mount';
import { BASE_CSS, PANEL_CSS } from '../shared/styles';

const COLLAPSE_KEY = 'loupe-panel-collapsed';

function Panel({ mp, settings, initial }: { mp: MarketplaceId; settings: Settings; initial: StoredProduct }) {
  const [p, setP] = useState(initial);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [toast, setToast] = useState('');

  useEffect(() => setP(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const h = heat(p.bsr, settings.heat);
  const age = ageInDays(p.firstAvailable);
  const royalties = p.price && p.productType ? royaltyAllTiers(settings.royalty, p.productType, mp, p.price) : null;
  const keywords = useMemo(
    () =>
      extractKeywords([
        { text: p.title, weight: 3 },
        { text: p.brand, weight: 2 },
        ...p.bullets.filter((b) => !isStockBullet(b)).map((b) => ({ text: b, weight: 1 })),
      ], 14),
    [p.asin, p.title],
  );
  const hits = useMemo(
    () =>
      scanText(
        { brand: p.brand, title: p.title, bullets: p.bullets.join(' \n ') },
        { custom: settings.customTerms, ignore: settings.ignoredTerms },
      ).filter((hit) => hit.kind !== 'policy' || hit.field !== 'bullets'),
    [p.asin, p.title],
  );
  const phrases = useMemo(() => phrasesToCheck(p.brand, p.title, 4), [p.asin, p.title]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* storage may be blocked */
    }
  };

  if (collapsed) {
    return (
      <div class="lp panel collapsed">
        <div class="panel-head">
          <span class="brandmark"><Logo size={16} /></span>
          <span class={`dot heat-${h}`} />
          <b class="num">{p.bsr ? fmt.bsr(p.bsr) : 'No BSR'}</b>
          <span class="muted num">{formatMonthly(salesPerMonth(p.bsr, mp))}</span>
          <button class="btn sm icon ghost" title="Expand Loupe" onClick={toggle}><ChevronUp size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div class="lp panel" role="complementary" aria-label="Loupe product insights">
      <div class="panel-head">
        <span class="brandmark"><Logo size={18} /> Loupe</span>
        <span class={`pill ${p.merch === 'yes' ? 'merch' : p.merch === 'likely' ? 'likely' : 'no'}`}>
          {p.merch === 'yes' ? 'Merch on Demand' : p.merch === 'likely' ? 'Probably Merch' : 'Not Merch'}
        </span>
        {p.productType && <span class="pill brand">{PRODUCT_TYPES[p.productType].short}</span>}
        <span class="grow" />
        <button class="btn sm icon ghost" title="Minimize" onClick={toggle}><ChevronDown size={14} /></button>
      </div>
      <div class="panel-body">
        <div>
          <div class="hero">
            <div>
              <div class="big num">{p.bsr ? fmt.bsr(p.bsr) : 'No BSR'}</div>
              <div class="cat">{p.bsrCategory ? `in ${p.bsrCategory}` : 'No sales rank, so no recent sales'}</div>
            </div>
            <span class="grow" />
            <span class="row" title="How this rank compares">
              <span class={`dot heat-${h}`} />
              <span class="muted">{HEAT_LABELS[h]}</span>
            </span>
          </div>
        </div>

        <div class="grid2">
          <div class="cell">
            <div class="k">Est. sales</div>
            <div class="v num">
              {formatMonthly(salesPerMonth(p.bsr, mp))}
              {p.bsr ? <small> · {(salesPerDay(p.bsr, mp) ?? 0).toFixed(1)}/day</small> : null}
            </div>
          </div>
          <div class="cell">
            <div class="k">Published</div>
            <div class="v num">
              {p.firstAvailable ? fmt.day(p.firstAvailable, 'long') : '–'}
              {age !== null ? <small> · {fmt.age(age)}</small> : null}
            </div>
          </div>
          <div class="cell">
            <div class="k">Price</div>
            <div class="v num">{p.price ? fmt.money(p.price, p.currency) : '–'}</div>
          </div>
          <div class="cell">
            <div class="k">Reviews</div>
            <div class="v num">
              {p.reviews ? fmt.int(p.reviews) : '0'}
              {p.rating ? <small> · {p.rating.toFixed(1)}★</small> : null}
            </div>
          </div>
        </div>

        {p.subRanks.length > 0 && (
          <div class="section">
            <h4>Category ranks</h4>
            <ul class="subranks">
              {p.subRanks.slice(0, 4).map((r) => (
                <li><b class="num">#{fmt.int(r.rank)}</b><span class="muted">{r.category}</span></li>
              ))}
            </ul>
          </div>
        )}

        {p.history.length >= 2 && (
          <div class="section" style={{ color: '#2a78d6' }}>
            <h4>BSR history</h4>
            <BsrSparkline points={p.history} />
          </div>
        )}

        {royalties && p.productType && p.price && (
          <div class="section">
            <h4>Royalty at {fmt.money(p.price, p.currency)} ({PRODUCT_TYPES[p.productType].label})</h4>
            <div class="tiers">
              {(Object.keys(royalties) as RoyaltyTier[]).map((tier) => (
                <div class={`cell ${tier === settings.royaltyTier ? 'active' : ''}`}>
                  <div class="k">{TIER_LABELS[tier]}</div>
                  <div class="v num">{fmt.money(royalties[tier], p.currency)}</div>
                </div>
              ))}
            </div>
            <div class="note" style={{ marginTop: '4px' }}>Estimate. Calibrate costs in Loupe → Royalties.</div>
          </div>
        )}

        <div class="section">
          <h4>Keywords</h4>
          <div class="chips">
            {keywords.map((k) => (
              <button
                class="chip-btn"
                title="Copy"
                onClick={async () => setToast((await copyText(k.phrase)) ? `Copied “${k.phrase}”` : 'Copy failed')}
              >
                {k.phrase}
              </button>
            ))}
            {keywords.length > 0 && (
              <button
                class="chip-btn"
                onClick={async () => setToast((await copyText(keywords.map((k) => k.phrase).join(', '))) ? 'Copied all keywords' : 'Copy failed')}
              >
                <Copy size={12} /> All
              </button>
            )}
          </div>
        </div>

        <div class="section">
          <h4>Trademark check</h4>
          {hits.length ? (
            <ul class="hits">
              {hits.slice(0, 6).map((hit) => (
                <li class={`sev-${hit.severity}`}>
                  <Alert size={14} />
                  <span><b>{hit.term}</b> in {hit.field}: <span class="muted">{hit.reason}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <div class="ok"><Shield size={14} /> No famous marks or policy terms found.</div>
          )}
          <div class="links" style={{ marginTop: '8px' }}>
            {phrases.map((phrase) => (
              <div class="row">
                <span class="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{phrase}”</span>
                <a href={usptoUrl(phrase)} target="_blank" rel="noopener">USPTO</a>
                <a href={tmviewUrl(phrase)} target="_blank" rel="noopener">TMview</a>
              </div>
            ))}
          </div>
        </div>

        <div class="actions">
          <button
            class="btn"
            aria-pressed={p.tracked ? 'true' : 'false'}
            onClick={async () => {
              const next = await setTracked(mp, p.asin, !p.tracked, p);
              if (next) setP(next);
              setToast(next?.tracked ? 'Tracking BSR in your watchlist' : 'Stopped tracking');
            }}
          >
            <Star size={14} filled={p.tracked} /> {p.tracked ? 'Tracking' : 'Track BSR'}
          </button>
          <button class="btn" onClick={async () => setToast((await copyText(p.asin)) ? `Copied ${p.asin}` : 'Copy failed')}>
            <Copy size={14} /> ASIN
          </button>
          {keywords[0] && (
            <a class="btn" href={merchSearchUrl(mp, keywords[0].phrase, settings.searchTemplates[mp])} title="Search Merch shirts for the top keyword">
              <Search size={14} /> Similar
            </a>
          )}
          <button
            class="btn icon"
            title="Open in Loupe"
            onClick={() => void chrome.runtime.sendMessage({ type: 'open-dashboard', hash: `watchlist?asin=${p.asin}&mp=${mp}` })}
          >
            <External size={14} />
          </button>
        </div>
        <div class="note">{MARKETPLACES[mp].flag} {p.asin} · Sales estimates are approximate.</div>
      </div>
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}

export function startProductPanel(mp: MarketplaceId, settings: Settings) {
  let mounted: Mounted | null = null;
  let currentAsin = '';

  const render = async () => {
    const asin = parseAsinFromUrl(location.href) ?? document.querySelector<HTMLInputElement>('input#ASIN')?.value ?? '';
    if (!asin || asin === currentAsin) return;
    currentAsin = asin;
    const parsed = parseProductDocument(document, mp, asin, location.href);
    if (!parsed.title) return;
    const prev = await getProduct(mp, parsed.asin);
    // Keep history for products the user looks at; untracked ones are pruned after 30 days.
    const stored = prev || parsed.bsr ? await saveProduct(parsed) : { ...parsed, history: [] };
    if (!mounted) {
      const host = document.createElement('loupe-panel');
      document.documentElement.appendChild(host);
      mounted = mount(host, BASE_CSS + PANEL_CSS);
    }
    mounted.render(<Panel mp={mp} settings={settings} initial={stored} />);
  };

  void render();
  // Variant pickers change the URL without a page load.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => void render(), 600);
    }
  }, 1000);
}
