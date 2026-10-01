import { icon } from '../ui/icons.js';
import { esc } from '../ui/dom.js';
import { streak, bestStreak, weekGrid, lastDays, sum } from '../lib/stats.js';
import { keyYmd, formatDate, minutesLabel } from '../lib/time.js';

const PROMPTS = [
  ['win', 'One win today', 'Small counts.'],
  ['fix', 'Where I fell short, and the fix', 'No guilt trip. Just the fix.'],
  ['thanks', 'Grateful for', 'Be specific.'],
];

const dateOf = (key, opts) => {
  const { y, m, d } = keyYmd(key);
  return formatDate(Date.UTC(y, m - 1, d, 12), 'UTC', opts);
};

function grid(app) {
  const cols = weekGrid(app.state.days, app.ctx.key, 15);
  const cells = cols
    .map(
      (col) =>
        `<div class="grid-col">${col
          .map((c) => `<span class="cell l${c.future ? 'x' : c.count}" title="${c.key}: ${c.count}/5"></span>`)
          .join('')}</div>`,
    )
    .join('');
  return `<div class="grid" role="img" aria-label="Prayers logged per day over the last 15 weeks">${cells}</div>
    <div class="grid-legend" aria-hidden="true"><span>0</span>${[0, 1, 2, 3, 4, 5].map((l) => `<span class="cell l${l}"></span>`).join('')}<span>5</span></div>`;
}

export function renderReflect(app) {
  const { days } = app.state;
  const key = app.ctx.key;
  const rec = app.dayRec();
  const note = rec.note ?? {};
  const week = lastDays(key, 7);
  const stats = [
    ['Streak', streak(days, key), 'days'],
    ['Best', bestStreak(days), 'days'],
    ['Focus', minutesLabel(sum(days, week, 'focus')), '7 days'],
    ['Dhikr', sum(days, week, 'dhikr'), '7 days'],
  ];

  const history = Object.keys(days)
    .filter((k) => k < key && days[k].note && Object.values(days[k].note).some((v) => v?.trim()))
    .sort()
    .reverse()
    .slice(0, 10);

  const one = rec.one?.text
    ? `<button type="button" class="one-row${rec.one.done ? ' is-done' : ''}" data-action="one-toggle" aria-pressed="${!!rec.one.done}">
        <span class="one-check">${icon('check')}</span><span><small>Your one thing</small>${esc(rec.one.text)}</span></button>`
    : '';

  return `<header class="view-head"><h2>Reflect</h2><p>Sixty seconds before sleep. Be honest, not harsh.</p></header>
    <dl class="stats">${stats
      .map(([label, value, unit]) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd><span>${unit}</span></div>`)
      .join('')}</dl>

    <section class="block">
      <p class="eyebrow">Salah · last 15 weeks</p>
      ${grid(app)}
    </section>

    <section class="block journal">
      <blockquote class="journal-quote">“Hold yourselves to account before you are held to account.”<cite>ʿUmar ibn al-Khattab</cite></blockquote>
      <p class="eyebrow">${esc(dateOf(key, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      ${one}
      ${PROMPTS.map(
        ([k, label, ph]) => `<div class="field">
          <label for="j-${k}">${label}</label>
          <textarea id="j-${k}" rows="2" maxlength="600" data-journal="${k}" placeholder="${ph}">${esc(note[k] ?? '')}</textarea>
        </div>`,
      ).join('')}
      <p class="saved" data-live="saved" aria-live="polite"></p>
      <p class="tip">Before sleep: wudu, lie on your right side, read Ayat al-Kursi. <span class="ref">Bukhari 247, 2311</span></p>
    </section>

    ${
      history.length
        ? `<section class="block"><p class="eyebrow">Past nights</p><div class="history">${history
            .map((k) => {
              const n = days[k].note;
              return `<details><summary>${esc(dateOf(k, { weekday: 'short', day: 'numeric', month: 'short' }))}<span>${esc(
                (n.win || n.thanks || n.fix || '').slice(0, 60),
              )}</span></summary>${PROMPTS.filter(([p]) => n[p]?.trim())
                .map(([p, label]) => `<p><small>${label}</small>${esc(n[p])}</p>`)
                .join('')}</details>`;
            })
            .join('')}</div></section>`
        : ''
    }`;
}
