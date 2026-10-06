// The agent's planner: which events to upload for now (school days, awareness
// months, profession weeks, sports seasons, heritage months, trends), what's
// coming, and the evergreen niches worth more designs.

import { useState } from 'preact/hooks';
import type { Evergreen, PlanItem, Portfolio } from '../../shared/agent';
import { KIND_LABEL, type EventKind } from '../../shared/events';
import * as fmt from '../../shared/format';
import { PRODUCT_TYPES } from '../../shared/products';
import { Card, Seg } from '../../ui/components';
import { Alert, Calendar, Search } from '../../ui/icons';
import { navigate } from '../data';
import { usePersistent } from './common';

const STAGE: Record<PlanItem['stage'], [string, string]> = {
  now: ['Upload now', 'bad'],
  selling: ['Shoppers buying', 'warn'],
  soon: ['Coming up', 'brand'],
  later: ['Plan ahead', 'neutral'],
  trend: ['Trend', 'brand'],
};

type KindFilter = EventKind | 'all';
const KINDS: KindFilter[] = ['all', 'school', 'awareness', 'profession', 'sports', 'heritage', 'holiday', 'fun', 'season'];

const when = (p: PlanItem) =>
  p.daysUntil <= 0 ? (p.start === p.end ? 'today' : `until ${fmt.day(p.end)}`) : `in ${p.daysUntil} day${p.daysUntil === 1 ? '' : 's'}`;

export function Planner({ portfolio }: { portfolio: Portfolio }) {
  const [kind, setKind] = usePersistent<KindFilter>('plan-kind', 'all');
  const [more, setMore] = useState(false);
  const items = portfolio.plan.filter((p) => p.stage !== 'trend' && p.size < 3 && (kind === 'all' || p.kind === kind));
  const top = items.filter((p) => p.stage === 'now' || p.stage === 'selling').slice(0, more ? 30 : 6);
  const later = items.filter((p) => p.stage === 'soon' || p.stage === 'later');
  const big = portfolio.plan.filter((p) => p.size === 3 && p.stage !== 'trend').sort((a, b) => a.daysUntil - b.daysUntil);
  const trends = portfolio.plan.filter((p) => p.stage === 'trend');

  return (
    <div class="stack">
      <div class="row wrap">
        <h2 class="grow">Upload plan: events worth designing for</h2>
        <Seg<KindFilter> label="Event type" value={kind} onChange={setKind} options={KINDS.map((k) => [k, k === 'all' ? 'All' : KIND_LABEL[k as EventKind]])} />
      </div>
      <p class="muted small" style={{ marginTop: '-6px' }}>
        Smaller events come first: schools, teams and units order in groups, and far fewer sellers upload for them than for Christmas. Each card says when to have designs live, who buys, and what your own designs did last year.
      </p>

      {top.length ? (
        <div class="plan-grid">{top.map((p) => <PlanCard item={p} />)}</div>
      ) : (
        <Card><p class="muted">Nothing in its upload window right now for this filter. See what's coming below.</p></Card>
      )}
      {items.filter((p) => p.stage === 'now' || p.stage === 'selling').length > 6 && (
        <button class="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(!more)}>{more ? 'Show fewer' : 'Show every event open now'}</button>
      )}

      {later.length > 0 && (
        <Card title={<h2>Coming up</h2>} pad={false}>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Event</th><th>Type</th><th class="num">Date</th><th class="num">Upload by</th><th class="num">Your designs</th><th class="num">Last year</th><th>Ideas</th></tr></thead>
              <tbody>
                {later.slice(0, 40).map((p) => (
                  <tr>
                    <td><b>{p.name}</b>{p.size === 1 && <span class="pill brand" style={{ marginLeft: '6px' }}>niche</span>}</td>
                    <td class="small">{KIND_LABEL[p.kind]}</td>
                    <td class="num nowrap">{fmt.day(p.start)} <span class="muted small">({when(p)})</span></td>
                    <td class="num nowrap">{fmt.day(p.uploadBy)}</td>
                    <td class="num">{p.designs ? fmt.int(p.designs) : <span class="pill warn">0</span>}</td>
                    <td class="num">{p.lastYear === null ? <span class="muted">–</span> : fmt.int(p.lastYear)}</td>
                    <td class="small">
                      <div class="chips">{p.ideas.slice(0, 2).map((i) => <Idea text={i} />)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div class="grid-2" style={{ alignItems: 'start' }}>
        <Evergreens list={portfolio.evergreens} />
        <Card title={<h2>Trends to test</h2>}>
          <div class="stack" style={{ gap: '12px' }}>
            {trends.map((t) => (
              <div class="stack" style={{ gap: '4px' }}>
                <div class="row"><b class="grow">{t.name}</b>{t.designs > 0 && <span class="pill good">{t.designs} designs</span>}</div>
                <span class="small">{t.advice}</span>
                <span class="small muted">{t.who}</span>
                <div class="chips">{t.ideas.map((i) => <Idea text={i} />)}</div>
                {t.caution && <span class="small warn-text"><Alert size={12} /> {t.caution}</span>}
              </div>
            ))}
            <p class="hint">Trends come and go within months. Upload a few, check sales weekly, and stop as soon as they fade.</p>
          </div>
        </Card>
      </div>

      {big.length > 0 && (
        <p class="small muted">
          <b>Big holidays</b> (everyone uploads for these, so only refresh your proven sellers):{' '}
          {big.slice(0, 6).map((b, i) => (
            <span>{i ? ' · ' : ''}{b.name} {fmt.day(b.start)}{b.designs ? ` (${b.designs} designs${b.lastYear ? `, ${b.lastYear} sold last year` : ''})` : ' (none yet)'}</span>
          ))}
        </p>
      )}
    </div>
  );
}

function Idea({ text }: { text: string }) {
  return (
    <button class="chip" title="Check demand for this phrase" onClick={() => navigate(`research?q=${encodeURIComponent(text)}`)}>
      <Search size={11} /> {text}
    </button>
  );
}

function PlanCard({ item: p }: { item: PlanItem }) {
  const [label, tone] = STAGE[p.stage];
  return (
    <section class="card plan-card">
      <div class="card-body stack" style={{ gap: '8px' }}>
        <div class="row wrap" style={{ gap: '6px' }}>
          <span class={`pill ${tone}`}>{label}</span>
          <span class="pill neutral">{KIND_LABEL[p.kind]}</span>
          {p.size === 1 && <span class="pill brand">niche</span>}
          <span class="right small muted nowrap"><Calendar size={12} /> {fmt.day(p.start)}{p.end !== p.start ? `–${fmt.day(p.end)}` : ''} · {when(p)}</span>
        </div>
        <h3 style={{ margin: 0 }}>{p.name}</h3>
        <p class="small" style={{ margin: 0 }}><b>{p.advice}</b></p>
        <p class="small muted" style={{ margin: 0 }}>
          Who buys: {p.who}.{' '}
          {p.stage === 'selling' ? `Buying since ${fmt.day(p.sellFrom)}.` : `Shoppers start ${fmt.day(p.sellFrom)}; be live by ${fmt.day(p.uploadBy)}.`}
        </p>
        <div class="row wrap small" style={{ gap: '6px' }}>
          <span class={`pill ${p.designs ? 'good' : 'warn'}`}>{p.designs ? `${p.designs} of your designs` : 'No designs yet'}</span>
          {p.lastYear !== null && <span class="pill neutral">{fmt.int(p.lastYear)} sold last year</span>}
          <span class="muted">Best on: {p.types.slice(0, 4).map((t) => PRODUCT_TYPES[t].short).join(', ')}</span>
        </div>
        {p.examples.length > 0 && <p class="small muted" style={{ margin: 0 }}>Yours: {p.examples.join(' · ')}</p>}
        {p.ideas.length > 0 && <div class="chips">{p.ideas.map((i) => <Idea text={i} />)}</div>}
        {p.caution && <p class="small warn-text" style={{ margin: 0 }}><Alert size={12} /> {p.caution}</p>}
      </div>
    </section>
  );
}

function Evergreens({ list }: { list: Evergreen[] }) {
  return (
    <Card title={<h2>Evergreens: make more of these</h2>}>
      {list.length ? (
        <div class="stack" style={{ gap: '12px' }}>
          {list.map((e) => (
            <div class="stack" style={{ gap: '4px' }}>
              <div class="row">
                <b class="grow">“{e.name}”</b>
                <span class="pill good">{fmt.int(e.units365)} sold this year</span>
              </div>
              <span class="small">{e.advice}</span>
              {e.examples.length > 0 && <span class="small muted">Best: {e.examples.join(' · ')}</span>}
              <div class="chips"><button class="chip" onClick={() => navigate(`research?q=${encodeURIComponent(e.name)}`)}><Search size={11} /> Find new angles for “{e.name}”</button></div>
            </div>
          ))}
        </div>
      ) : (
        <p class="muted small">No niche sells steadily across the year yet (Loupe needs about a year of sales to tell). Seasonal niches show up in the plan above instead.</p>
      )}
    </Card>
  );
}
