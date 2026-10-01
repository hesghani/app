import { icon } from '../ui/icons.js';
import { esc, ring } from '../ui/dom.js';
import { DHIKR } from '../data/dhikr.js';

export const TAP_SIZE = 280;

export function currentDhikr(state) {
  const set = DHIKR.find((d) => d.id === state.dhikr.sel) ?? DHIKR[0];
  const step = Math.min(state.dhikr.step, set.steps.length - 1);
  return { set, step, item: set.steps[step], count: state.dhikr.count, done: !!state.dhikr.done };
}

export function renderDhikr(app) {
  const { set, step, item, count, done } = currentDhikr(app.state);
  const today = app.dayRec().dhikr || 0;
  const chips = DHIKR.map(
    (d) =>
      `<button type="button" role="radio" aria-checked="${d.id === set.id}" data-action="dhikr-sel" data-id="${d.id}">${esc(d.name)}</button>`,
  ).join('');
  const dots =
    set.steps.length > 1
      ? `<div class="steps" aria-label="Step ${step + 1} of ${set.steps.length}">${set.steps
          .map((s, i) => `<span class="step${i < step || (done && i === step) ? ' is-done' : ''}${i === step && !done ? ' is-now' : ''}">${s.n}</span>`)
          .join('')}</div>`
      : '';

  return `<header class="view-head"><h2>Dhikr</h2><p><span data-live="dhikr-today">${today}</span> today. Tap anywhere on the circle.</p></header>
    <div class="chips" role="radiogroup" aria-label="Choose a dhikr">${chips}</div>
    <section class="tap-stage">
      ${dots}
      <button type="button" class="tap${done ? ' is-complete' : ''}" data-action="dhikr-tap" aria-label="Count ${esc(item.tr)}. ${count} of ${item.n}.">
        <svg viewBox="0 0 ${TAP_SIZE} ${TAP_SIZE}" aria-hidden="true">${ring({ r: 128, stroke: 6, value: count / item.n, cls: 'r-dhikr', size: TAP_SIZE })}</svg>
        <span class="tap-ar" lang="ar" dir="rtl">${item.ar}</span>
        <span class="tap-count" data-live="dhikr-count">${count}</span>
        <span class="tap-target">${done ? 'Complete · tap to restart' : `of ${item.n}`}</span>
      </button>
      <p class="tap-tr">${esc(item.tr)}</p>
      <p class="tap-en">${esc(item.en)}</p>
      <div class="tap-tools">
        <button type="button" class="ghost-btn" data-action="dhikr-undo">${icon('undo')}Undo</button>
        <button type="button" class="ghost-btn" data-action="dhikr-reset">${icon('reset')}Reset</button>
      </div>
      <p class="tap-note">${esc(set.note)} <span class="ref">${esc(set.ref)}</span></p>
    </section>`;
}
