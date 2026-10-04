// Search results overlay: a toolbar summarizing the page and a badge on every
// result with BSR, estimated sales, age and Merch detection.

import type { ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { formatMonthly, heat, salesPerMonth } from '../../shared/bsr';
import { toCsv } from '../../shared/csv';
import { ageInDays } from '../../shared/dates';
import * as fmt from '../../shared/format';
import { MARKETPLACES, merchSearchUrl, plainSearchUrl, productUrl, type MarketplaceId } from '../../shared/marketplaces';
import { nicheScore } from '../../shared/niche';
import { CARD_SELECTOR, readCards, readResultCount, type SearchCard } from '../../shared/parse-search';
import { PRODUCT_TYPES } from '../../shared/products';
import { PoliteQueue } from '../../shared/queue';
import { CaptchaError, fetchProduct } from '../../shared/research';
import type { Settings } from '../../shared/settings';
import { getProducts, productKey, saveProduct, setTracked } from '../../shared/storage';
import type { StoredProduct } from '../../shared/types';
import { Alert, Copy, Download, External, Logo, Refresh, Star } from '../../ui/icons';
import { copyText, download, mount, type Mounted } from '../shared/mount';
import { Emitter, useEmitter } from '../shared/store';
import { BASE_CSS, SEARCH_CSS } from '../shared/styles';

type Status = 'pending' | 'loading' | 'done' | 'error';

interface Entry {
  asin: string;
  index: number;
  card: SearchCard;
  status: Status;
  data?: StoredProduct;
  error?: string;
  badge?: Mounted;
}

type Sort = 'relevance' | 'bsr' | 'newest' | 'reviews';

interface View {
  sort: Sort;
  merchOnly: boolean;
  hideSponsored: boolean;
  maxBsr: number;
}

const CSS = BASE_CSS + SEARCH_CSS;

class SearchSession extends Emitter {
  entries = new Map<string, Entry>();
  captcha = false;
  started = false;
  view: View = { sort: 'relevance', merchOnly: false, hideSponsored: false, maxBsr: 0 };
  toast = '';
  private queue: PoliteQueue;
  private anchor: Comment | null = null;
  private toastTimer = 0;

  constructor(public mp: MarketplaceId, public settings: Settings) {
    super();
    this.queue = new PoliteQueue({ concurrency: settings.concurrency, minDelay: 250, maxDelay: 900 });
  }

  get list(): Entry[] {
    return Array.from(this.entries.values()).sort((a, b) => a.index - b.index);
  }

  flash(message: string) {
    this.toast = message;
    this.emit();
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast = '';
      this.emit();
    }, 2200);
  }

  /** Picks up result cards, including ones Amazon adds after load. */
  scan() {
    let added = 0;
    for (const card of readCards(document)) {
      const existing = this.entries.get(card.asin);
      if (existing && existing.card.element === card.element && existing.card.element.isConnected) continue;
      const entry: Entry = existing ?? { asin: card.asin, index: this.entries.size, card, status: 'pending' };
      entry.card = card;
      if (!this.anchor || !this.anchor.isConnected) {
        this.anchor = document.createComment('loupe-anchor');
        card.element.parentNode?.insertBefore(this.anchor, card.element);
      }
      this.entries.set(card.asin, entry);
      this.mountBadge(entry);
      added += 1;
    }
    if (added) {
      this.emit();
      if (this.started) void this.analyze();
    }
  }

  private mountBadge(entry: Entry) {
    const el = entry.card.element;
    if (el.querySelector(':scope loupe-badge')) return;
    const host = document.createElement('loupe-badge');
    host.style.display = 'block';
    // Size from the card, never from our content, so long text can't widen Amazon's grid.
    host.style.contain = 'inline-size';
    host.style.minWidth = '0';
    const container = el.querySelector('.puis-card-container, .s-card-container') ?? el;
    container.insertBefore(host, container.firstChild);
    entry.badge = mount(host, CSS, <Badge session={this} asin={entry.asin} />);
  }

  async analyze() {
    this.started = true;
    const pending = this.list.filter((e) => e.status === 'pending' || e.status === 'error');
    if (!pending.length) return;
    const cached = await getProducts(pending.map((e) => productKey(this.mp, e.asin)));
    const freshFor = this.settings.cacheHours * 3600_000;
    for (const entry of pending) {
      const hit = cached[productKey(this.mp, entry.asin)];
      if (hit && Date.now() - hit.fetchedAt < freshFor) {
        entry.data = hit;
        entry.status = 'done';
        continue;
      }
      entry.status = 'loading';
      entry.error = undefined;
      this.queue
        .add(async () => {
          if (this.captcha) throw new CaptchaError();
          return fetchProduct(this.mp, entry.asin, { sameOrigin: true });
        })
        .then(async (data) => {
          entry.data = await saveProduct(data);
          entry.status = 'done';
          this.afterUpdate();
        })
        .catch((error: Error) => {
          if (error instanceof CaptchaError) {
            this.captcha = true;
            this.queue.pause();
            entry.status = 'pending';
          } else {
            entry.status = 'error';
            entry.error = error.message;
          }
          this.afterUpdate();
        });
    }
    this.afterUpdate();
  }

  resume() {
    this.captcha = false;
    this.queue.resume();
    void this.analyze();
    this.emit();
  }

  async toggleTrack(entry: Entry) {
    if (!entry.data) return;
    const next = await setTracked(this.mp, entry.asin, !entry.data.tracked, entry.data);
    if (next) entry.data = next;
    this.flash(next?.tracked ? 'Tracking BSR. See it in Loupe → Watchlist.' : 'Stopped tracking.');
  }

  private afterUpdate() {
    if (this.view.sort !== 'relevance' || this.view.merchOnly || this.view.maxBsr) this.applyView();
    this.emit();
  }

  setView(patch: Partial<View>) {
    this.view = { ...this.view, ...patch };
    this.applyView();
    this.emit();
  }

  /** Reorders and hides result cards in Amazon's own grid. */
  applyView() {
    const v = this.view;
    const list = this.list;
    for (const e of list) {
      const d = e.data;
      const hide =
        (v.hideSponsored && e.card.sponsored) ||
        (v.merchOnly && d !== undefined && d.merch === 'no') ||
        (v.maxBsr > 0 && d !== undefined && (!d.bsr || d.bsr > v.maxBsr));
      e.card.element.style.display = hide ? 'none' : '';
    }
    const anchor = this.anchor;
    if (!anchor?.parentNode) return;
    const key = (e: Entry): number => {
      switch (v.sort) {
        case 'bsr': return e.data?.bsr ?? Number.MAX_SAFE_INTEGER;
        case 'newest': return -(e.data?.firstAvailable ? Date.parse(e.data.firstAvailable) : -Number.MAX_SAFE_INTEGER);
        case 'reviews': return -(e.data?.reviews ?? e.card.reviews ?? -1);
        default: return e.index;
      }
    };
    const sorted = [...list].sort((a, b) => key(a) - key(b) || a.index - b.index);
    for (const e of sorted) {
      if (e.card.element.parentNode === anchor.parentNode) anchor.parentNode.insertBefore(e.card.element, anchor);
    }
  }

  stats() {
    const list = this.list;
    const done = list.filter((e) => e.data);
    const organic = done.filter((e) => !e.card.sponsored);
    const ranked = organic.map((e) => e.data!).filter((d) => d.bsr);
    const bsrs = ranked.map((d) => d.bsr!).sort((a, b) => a - b);
    const median = (xs: number[]) => (xs.length ? xs[Math.floor((xs.length - 1) / 2)]! : null);
    const ages = organic
      .map((e) => ageInDays(e.data!.firstAvailable))
      .filter((a): a is number => a !== null)
      .sort((a, b) => a - b);
    const totalResults = readResultCount(document);
    const medianBsr = median(bsrs);
    const under100k = bsrs.filter((b) => b <= 100_000).length;
    return {
      total: list.length,
      done: done.length,
      loading: list.filter((e) => e.status === 'loading').length,
      merch: done.filter((e) => e.data!.merch !== 'no').length,
      medianBsr,
      under100k,
      avgMonthly: ranked.length ? ranked.reduce((s, d) => s + (salesPerMonth(d.bsr, this.mp) ?? 0), 0) / ranked.length : null,
      medianAge: median(ages),
      totalResults,
      score: ranked.length >= 3
        ? nicheScore({ medianBsr, totalResults, medianAgeDays: median(ages), under100kShare: organic.length ? under100k / organic.length : 0 })
        : null,
    };
  }

  exportCsv() {
    const header = ['ASIN', 'Title', 'Brand', 'Price', 'BSR', 'Category', 'Est. sales / month', 'First available', 'Age (days)', 'Reviews', 'Rating', 'Merch', 'Product type', 'Sponsored', 'URL'];
    const rows = this.list.map((e) => {
      const d = e.data;
      return [
        e.asin, d?.title ?? e.card.title, d?.brand ?? '', d?.price ?? e.card.price ?? '', d?.bsr ?? '', d?.bsrCategory ?? '',
        d?.bsr ? (salesPerMonth(d.bsr, this.mp) ?? 0).toFixed(1) : '', d?.firstAvailable ?? '', ageInDays(d?.firstAvailable ?? null) ?? '',
        d?.reviews ?? e.card.reviews ?? '', d?.rating ?? e.card.rating ?? '', d?.merch ?? '', d?.productType ? PRODUCT_TYPES[d.productType].label : '',
        e.card.sponsored ? 'yes' : '', productUrl(this.mp, e.asin),
      ];
    });
    const keyword = new URLSearchParams(location.search).get('k') ?? 'search';
    download(`loupe-${this.mp}-${keyword.replace(/[^\w-]+/g, '-')}.csv`, toCsv([header, ...rows]));
    this.flash(`Exported ${rows.length} products`);
  }
}

function Badge({ session, asin }: { session: SearchSession; asin: string }) {
  useEmitter(session);
  const entry = session.entries.get(asin);
  if (!entry) return null;
  const d = entry.data;
  const mp = session.mp;

  if (entry.status === 'error') {
    return (
      <div class="lp badge">
        <div class="top">
          <span class="err">Couldn't read this product.</span>
          <button class="btn sm ghost" onClick={() => void session.analyze()}>Retry</button>
        </div>
      </div>
    );
  }
  if (!d) {
    return (
      <div class="lp badge">
        {entry.status === 'loading' ? <div class="shimmer" aria-label="Loading BSR" /> : <span class="muted">{session.captcha ? 'Paused (robot check)' : 'Waiting…'}</span>}
      </div>
    );
  }
  const h = heat(d.bsr, session.settings.heat);
  const monthly = salesPerMonth(d.bsr, mp);
  const age = ageInDays(d.firstAvailable);
  const sub = d.subRanks[0];
  return (
    <div class="lp badge">
      <div class="top">
        <span class={`dot heat-${h}`} />
        <span class="rank num" title={d.bsrCategory ? `Best Sellers Rank in ${d.bsrCategory}` : 'No Best Sellers Rank (no recent sales)'}>
          {d.bsr ? fmt.bsr(d.bsr) : 'No BSR'}
        </span>
        <span class="num muted" title="Estimated sales per month from BSR">{formatMonthly(monthly)}</span>
        <span class="sep">·</span>
        <span class="num muted" title={d.firstAvailable ? `First available ${fmt.day(d.firstAvailable, 'long')}` : 'Publish date unknown'}>
          {fmt.age(age)}
        </span>
        {entry.card.sponsored && <span class="pill sponsored">Ad</span>}
        <span class={`pill ${d.merch === 'yes' ? 'merch' : d.merch === 'likely' ? 'likely' : 'no'}`}>
          {d.merch === 'yes' ? 'Merch' : d.merch === 'likely' ? 'Merch?' : 'Not Merch'}
        </span>
        <button
          class="btn sm icon ghost track"
          aria-pressed={d.tracked ? 'true' : 'false'}
          title={d.tracked ? 'Stop tracking BSR' : 'Track BSR in your watchlist'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void session.toggleTrack(entry);
          }}
        >
          <Star size={14} filled={d.tracked} />
        </button>
      </div>
      <div class="sub">
        {d.productType ? `${PRODUCT_TYPES[d.productType].short} · ` : ''}
        {sub ? `#${fmt.int(sub.rank)} in ${sub.category}` : d.bsrCategory ? `in ${d.bsrCategory}` : 'No sales rank yet'}
        {d.reviews ? ` · ${fmt.int(d.reviews)} reviews` : ''}
      </div>
    </div>
  );
}

function Toolbar({ session }: { session: SearchSession }) {
  useEmitter(session);
  const [busy, setBusy] = useState(false);
  const s = session.stats();
  const v = session.view;
  const params = new URLSearchParams(location.search);
  const keyword = params.get('k') ?? '';
  const merchFilterOn = params.has('hidden-keywords');
  const progress = s.total ? (s.done / s.total) * 100 : 0;

  return (
    <div class="lp bar" role="region" aria-label="Loupe research toolbar">
      <div class="bar-head">
        <span class="brandmark"><Logo size={18} /> Loupe</span>
        <span class="muted">
          {MARKETPLACES[session.mp].flag}{' '}
          {!session.started
            ? `${s.total} results on this page`
            : s.done < s.total
              ? `Analyzing ${s.done} of ${s.total}…`
              : `${s.done} products analyzed`}
        </span>
        <span class="grow" />
        {!session.started && (
          <button class="btn primary" onClick={() => void session.analyze()}>
            Analyze page
          </button>
        )}
        {keyword && (
          <button
            class="btn"
            aria-pressed={merchFilterOn ? 'true' : 'false'}
            title={merchFilterOn ? 'Showing Merch on Demand shirts only. Click to see all results.' : 'Show only Merch on Demand shirts'}
            onClick={() => {
              location.href = merchFilterOn
                ? plainSearchUrl(session.mp, keyword)
                : merchSearchUrl(session.mp, keyword, session.settings.searchTemplates[session.mp]);
            }}
          >
            {merchFilterOn ? 'Merch filter on' : 'Merch filter'}
          </button>
        )}
      </div>
      {session.started && s.done < s.total && (
        <div class="progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      {session.captcha && (
        <div class="banner" role="alert">
          <Alert size={16} />
          <span class="grow">Amazon is asking for a robot check. Open any product in a new tab, solve it, then resume.</span>
          <button class="btn sm" onClick={() => session.resume()}>Resume</button>
        </div>
      )}
      {session.started && (
        <div class="stats">
          <Stat k="Niche score" v={s.score === null ? '–' : <span class="score"><b>{s.score}</b><small>/100</small></span>} />
          <Stat k="Median BSR" v={fmt.bsr(s.medianBsr)} />
          <Stat k="Under 100k" v={`${s.under100k}`} small={s.done ? `of ${s.done}` : ''} />
          <Stat k="Avg sales" v={s.avgMonthly === null ? '–' : formatMonthly(s.avgMonthly)} />
          <Stat k="Median age" v={fmt.age(s.medianAge)} />
          <Stat k="Merch listings" v={`${s.merch}`} small={s.done ? `of ${s.done}` : ''} />
          <Stat k="Results" v={fmt.compact(s.totalResults)} />
        </div>
      )}
      {session.started && (
        <div class="controls">
          <span class="label">Sort</span>
          <div class="seg" role="group" aria-label="Sort results">
            {(['relevance', 'bsr', 'newest', 'reviews'] as Sort[]).map((sort) => (
              <button aria-pressed={v.sort === sort ? 'true' : 'false'} onClick={() => session.setView({ sort })}>
                {sort === 'relevance' ? 'Amazon' : sort === 'bsr' ? 'Best BSR' : sort === 'newest' ? 'Newest' : 'Reviews'}
              </button>
            ))}
          </div>
          <span class="label">Show</span>
          <button class="btn sm" aria-pressed={v.merchOnly ? 'true' : 'false'} onClick={() => session.setView({ merchOnly: !v.merchOnly })}>
            Merch only
          </button>
          <button class="btn sm" aria-pressed={v.hideSponsored ? 'true' : 'false'} onClick={() => session.setView({ hideSponsored: !v.hideSponsored })}>
            Hide ads
          </button>
          <select
            class="select"
            aria-label="Maximum BSR"
            value={String(v.maxBsr)}
            onChange={(e) => session.setView({ maxBsr: Number((e.target as HTMLSelectElement).value) })}
          >
            <option value="0">Any BSR</option>
            <option value="50000">BSR ≤ 50k</option>
            <option value="100000">BSR ≤ 100k</option>
            <option value="250000">BSR ≤ 250k</option>
            <option value="500000">BSR ≤ 500k</option>
            <option value="1000000">BSR ≤ 1M</option>
          </select>
          <span class="grow" />
          <button
            class="btn sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await copyText(session.list.map((e) => e.asin).join('\n'));
              setBusy(false);
              session.flash(ok ? `Copied ${session.list.length} ASINs` : 'Copy failed');
            }}
          >
            <Copy size={13} /> ASINs
          </button>
          <button class="btn sm" onClick={() => session.exportCsv()}>
            <Download size={13} /> CSV
          </button>
          <button
            class="btn sm icon"
            title="Re-check every product now"
            onClick={() => {
              for (const e of session.entries.values()) {
                e.status = 'pending';
                if (e.data) e.data = { ...e.data, fetchedAt: 0 };
              }
              session.settings = { ...session.settings, cacheHours: 0 };
              void session.analyze();
            }}
          >
            <Refresh size={13} />
          </button>
          <button
            class="btn sm icon"
            title="Open Loupe dashboard"
            onClick={() => void chrome.runtime.sendMessage({ type: 'open-dashboard', hash: keyword ? `research?q=${encodeURIComponent(keyword)}&mp=${session.mp}` : 'research' })}
          >
            <External size={13} />
          </button>
        </div>
      )}
      {session.toast && <div class="toast" role="status">{session.toast}</div>}
    </div>
  );
}

function Stat({ k, v, small }: { k: string; v: ComponentChild; small?: string }) {
  return (
    <div class="stat">
      <div class="k">{k}</div>
      <div class="v num">
        {v}
        {small ? <small>{small}</small> : null}
      </div>
    </div>
  );
}

export function isSearchPage(): boolean {
  return location.pathname === '/s' || location.pathname.startsWith('/s/') || Boolean(document.querySelector(CARD_SELECTOR));
}

export function startSearchOverlay(mp: MarketplaceId, settings: Settings) {
  const session = new SearchSession(mp, settings);
  let toolbar: Mounted | null = null;

  const placeToolbar = () => {
    if (toolbar?.host.isConnected) return;
    const slot = document.querySelector('.s-main-slot');
    const parent = slot?.parentElement ?? document.querySelector('#search');
    if (!parent) return;
    const host = document.createElement('loupe-toolbar');
    host.style.display = 'block';
    if (slot) parent.insertBefore(host, slot);
    else parent.prepend(host);
    toolbar = mount(host, CSS, <Toolbar session={session} />);
  };

  placeToolbar();
  session.scan();
  if (settings.autoAnalyze) void session.analyze();

  let timer = 0;
  new MutationObserver((mutations) => {
    if (mutations.every((m) => Array.from(m.addedNodes).every((n) => n instanceof Element && n.hasAttribute('data-loupe')))) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      placeToolbar();
      session.scan();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });

  return session;
}
