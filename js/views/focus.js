import { icon } from '../ui/icons.js';
import { esc, ring } from '../ui/dom.js';
import { NAMES } from '../core.js';
import { countdown, minutesLabel, keyYmd, formatDate } from '../lib/time.js';
import { lastDays } from '../lib/stats.js';

const SIZE = 248;

export function defaultFocusMode(c) {
  return c.nextPrayer.at - c.now >= 15 * 60000 ? 'prayer' : '25';
}

function weekBars(app) {
  const keys = lastDays(app.ctx.key, 7);
  const vals = keys.map((k) => app.state.days[k]?.focus || 0);
  const max = Math.max(60, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const bars = keys
    .map((k, i) => {
      const { y, m, d } = keyYmd(k);
      const label = formatDate(Date.UTC(y, m - 1, d, 12), 'UTC', { weekday: 'narrow' });
      const pct = Math.round((vals[i] / max) * 100);
      return `<div class="bar${i === 6 ? ' is-today' : ''}" title="${minutesLabel(vals[i])}">
        <span class="bar-track"><span class="bar-fill${vals[i] ? '' : ' is-empty'}" style="height:${vals[i] ? Math.max(pct, 6) : 4}%"></span></span>
        <span class="bar-label">${label}</span>
      </div>`;
    })
    .join('');
  return `<section class="block">
    <div class="rings-head"><p class="eyebrow">Last 7 days</p><p class="rings-note">${minutesLabel(total)} focused</p></div>
    <div class="bars" role="img" aria-label="Focus minutes per day for the last 7 days: ${vals.map(minutesLabel).join(', ')}">${bars}</div>
  </section>`;
}

export function renderFocus(app) {
  const c = app.ctx;
  const f = app.state.focus;
  const head = `<header class="view-head"><h2>Focus</h2><p>Work in blocks between prayers. When the adhan comes, you stop.</p></header>`;

  if (f) {
    const total = f.end - f.start;
    const left = Math.max(0, f.end - c.now);
    const until = f.until ? `until ${NAMES[f.until]}` : `${Math.round(total / 60000)}-minute block`;
    return `${head}
      <section class="focus-stage is-running">
        <div class="timer">
          <svg viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${ring({ r: 112, stroke: 8, value: 1 - left / total, cls: 'r-accent', size: SIZE })}</svg>
          <div class="timer-center">
            <span class="timer-time" data-cd="${f.end}" aria-live="off">${countdown(left)}</span>
            <span class="timer-sub">${esc(until)}</span>
          </div>
        </div>
        ${f.label ? `<p class="focus-label">${esc(f.label)}</p>` : ''}
        <p class="focus-hint">Phone face down. One tab. Go.</p>
        <button type="button" class="btn" data-action="focus-stop">${icon('stop')}End block</button>
      </section>
      ${weekBars(app)}`;
  }

  if (app.ui.focusDone) {
    const d = app.ui.focusDone;
    const line = d.until && d.reason === 'done' ? `${NAMES[d.until]} is in. Go pray, then come back for the next block.` : 'Take a short break. Stretch, drink water, make dhikr.';
    return `${head}
      <section class="focus-stage is-done">
        <p class="done-title">Alhamdulillah.</p>
        <p class="done-sub">${minutesLabel(d.min)} of deep work.</p>
        <p class="focus-hint">${line}</p>
        <button type="button" class="btn primary" data-action="focus-new">New block</button>
      </section>
      ${weekBars(app)}`;
  }

  const mode = app.ui.focusMode ?? defaultFocusMode(c);
  const n = c.nextPrayer;
  const toPrayer = n.at - c.now;
  const capped = mode === 'prayer' || Number(mode) * 60000 >= toPrayer;
  const preview = capped ? toPrayer : Number(mode) * 60000;
  const one = app.dayRec().one;
  const options = [
    ['prayer', `Until ${NAMES[n.id]}`],
    ['25', '25 min'],
    ['50', '50 min'],
    ['90', '90 min'],
  ];
  return `${head}
    <section class="focus-stage">
      <div class="timer">
        <svg viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${ring({ r: 112, stroke: 8, value: 0, cls: 'r-accent', size: SIZE })}</svg>
        <div class="timer-center">
          <span class="timer-time"${capped ? ` data-cd="${n.at}"` : ''}>${countdown(preview)}</span>
          <span class="timer-sub">${capped ? `until ${NAMES[n.id]} · ${esc(app.clock(n.at))}` : 'deep work'}</span>
        </div>
      </div>
      <div class="seg" role="radiogroup" aria-label="Block length">
        ${options
          .map(
            ([v, label]) =>
              `<button type="button" role="radio" aria-checked="${mode === v}" data-action="focus-mode" data-mode="${v}">${label}</button>`,
          )
          .join('')}
      </div>
      <div class="field">
        <label class="eyebrow" for="focus-label">Working on</label>
        <input id="focus-label" maxlength="80" autocomplete="off" placeholder="One task. Just one." value="${esc(one?.text ?? '')}">
      </div>
      <button type="button" class="btn primary wide" data-action="focus-start">${icon('play')}Start with Bismillah</button>
    </section>
    ${weekBars(app)}`;
}
