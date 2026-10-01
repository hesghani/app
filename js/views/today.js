import { icon } from '../ui/icons.js';
import { esc, ring } from '../ui/dom.js';
import { NAMES } from '../core.js';
import { PRAYERS } from '../lib/praytimes.js';
import { countdown, clockParts, formatDate } from '../lib/time.js';
import { prayedCount, streak } from '../lib/stats.js';
import { SOURCES } from '../data/wisdom.js';

const clamp = (v) => Math.max(0, Math.min(1, v));

// The sun (or moon) travelling across today's sky, with the prayers marked on its path.
export function arcSVG(c) {
  const W = 320;
  const base = 96;
  const cx = W / 2;
  const rx = 140;
  const ry = 80;
  const pt = (f) => [cx - rx * Math.cos(Math.PI * f), base - ry * Math.sin(Math.PI * f)];
  const seg = (f0, f1) => {
    const [x0, y0] = pt(f0);
    const [x1, y1] = pt(f1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${rx} ${ry} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const { day, night, now } = c;
  const isDay = !c.beforeFajr && day.sunrise != null && day.sunset != null && now < day.sunset;
  const time = (ms) => (ms == null ? '' : clockParts(ms, c.tz, c.h12).time);

  let start, end, ticks, highlight, left, right;
  if (isDay) {
    [start, end] = [day.sunrise, day.sunset];
    ticks = [
      ['Dhuhr', day.dhuhr],
      ['Asr', day.asr],
    ];
    left = `↑ ${time(day.sunrise)}`;
    right = `${time(day.sunset)} ↓`;
  } else {
    [start, end] = [night.start, night.end];
    ticks = [
      ['Isha', day.isha],
      ['Last third', night.lastThird],
    ];
    highlight = night.lastThird;
    left = `Sunset ${time(night.start)}`;
    right = `Fajr ${time(night.end)}`;
  }
  if (start == null || end == null) return '';
  const frac = (ms) => clamp((ms - start) / (end - start));
  const f = frac(now);
  const [bx, by] = pt(f);

  const tickMarks = ticks
    .filter(([, at]) => at != null && at > start && at < end)
    .map(([label, at]) => {
      const [x, y] = pt(frac(at));
      const passed = now >= at;
      const nearBody = Math.hypot(x - bx, y - by) < 26; // the sun or moon would cover the label
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" class="arc-tick${passed ? ' is-passed' : ''}"/>
        ${nearBody ? '' : `<text x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" class="arc-label">${label}</text>`}`;
    })
    .join('');

  const body = isDay
    ? `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="15" class="sun-glow"/><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="6.5" class="sun"/>`
    : `<mask id="moon-cut"><rect width="${W}" height="112" fill="#fff"/><circle cx="${(bx + 3.2).toFixed(1)}" cy="${(by - 2.4).toFixed(1)}" r="5.6" fill="#000"/></mask>
       <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="13" class="moon-glow"/>
       <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="6.5" class="moon" mask="url(#moon-cut)"/>`;

  const alt = `${c.sunAlt >= 0 ? '+' : '−'}${Math.abs(c.sunAlt).toFixed(1)}°`;
  return `<svg viewBox="0 0 ${W} 112" class="arc" role="img" aria-label="${isDay ? 'Sun' : 'Moon'} position: ${Math.round(f * 100)}% through the ${isDay ? 'day' : 'night'}">
    <path d="${seg(0, 1)}" class="arc-path"/>
    ${highlight != null && highlight < end ? `<path d="${seg(frac(highlight), 1)}" class="arc-third"/>` : ''}
    <path d="${seg(0, f)}" class="arc-done"/>
    <line x1="0" y1="${base}" x2="${W}" y2="${base}" class="arc-horizon"/>
    ${tickMarks}
    ${body}
    <text x="4" y="110" class="arc-end">${left}</text>
    <text x="${cx}" y="110" text-anchor="middle" class="arc-end arc-alt">sun ${alt}</text>
    <text x="${W - 4}" y="110" text-anchor="end" class="arc-end">${right}</text>
  </svg>`;
}

function hero(app) {
  const c = app.ctx;
  const rec = app.dayRec();
  const n = c.nextPrayer;
  const at = clockParts(n.at, c.tz, c.h12);

  let chip = '';
  if (c.ramadan) {
    const label = c.ramadan.mode === 'iftar' ? 'Iftar' : 'Suhoor ends';
    chip = `<p class="chip">${icon('moon')}<span>${label} ${esc(app.clock(c.ramadan.at))}</span><span class="chip-cd" data-cd="${c.ramadan.at}">${countdown(c.ramadan.at - c.now)}</span></p>`;
  } else if (c.fajrEnds) {
    chip = `<p class="chip">${icon('sunrise')}<span>Fajr ends at sunrise</span><span class="chip-cd" data-cd="${c.fajrEnds}">${countdown(c.fajrEnds - c.now)}</span></p>`;
  }

  const pills = PRAYERS.map((id) => {
    const t = c.day[id];
    const started = t != null && t <= c.now;
    const done = !!rec.p[id];
    const cls = ['pill', done && 'is-done', c.currentId === id && 'is-now', !started && 'is-later'].filter(Boolean).join(' ');
    const label = `${NAMES[id]} ${app.clock(t)}${done ? ', prayed' : started ? ', tap to mark prayed' : ', not yet'}`;
    return `<button type="button" class="${cls}" data-action="pray" data-id="${id}" aria-pressed="${done}" aria-label="${label}"${started ? '' : ' disabled'}>
      <span class="pill-dot">${icon('check')}</span>
      <span class="pill-name">${NAMES[id]}</span>
      <span class="pill-time">${clockParts(t, c.tz, c.h12).time}</span>
    </button>`;
  }).join('');

  return `<section class="hero sky" aria-label="Prayer times">
    <div class="hero-top">
      <span>${esc(formatDate(c.now, c.tz))}</span>
      <span>${esc(c.hijriText)}</span>
    </div>
    <div class="hero-arc" data-live="arc">${arcSVG(c)}</div>
    <div class="hero-main">
      <p class="hero-eyebrow">${n.tomorrow ? 'Tomorrow' : 'Next'} · ${at.time}${at.period ? ` ${at.period}` : ''}</p>
      <h1 class="hero-name">${NAMES[n.id]}</h1>
      <p class="hero-count">in <span data-cd="${n.at}">${countdown(n.at - c.now)}</span></p>
    </div>
    ${chip}
    <div class="pills" role="group" aria-label="Today’s prayers">${pills}</div>
  </section>`;
}

function nudge(c) {
  if (!c.nudge) return '';
  return `<p class="nudge"><span>${esc(c.nudge.text)}</span>${c.nudge.ref ? `<span class="ref">${esc(c.nudge.ref)}</span>` : ''}</p>`;
}

function oneThing(app) {
  const one = app.dayRec().one;
  if (!one?.text || app.ui.editingOne) {
    return `<section class="block">
      <label class="eyebrow" for="one-input">Today’s one thing</label>
      <form class="one-form" data-submit="one">
        <input id="one-input" name="one" maxlength="120" autocomplete="off" enterkeyhint="done"
          placeholder="What would make today a win?" value="${esc(one?.text ?? '')}">
        <button class="icon-btn solid" aria-label="Save">${icon('arrow')}</button>
      </form>
    </section>`;
  }
  return `<section class="block">
    <p class="eyebrow">Today’s one thing</p>
    <div class="one${one.done ? ' is-done' : ''}">
      <button type="button" class="one-check" data-action="one-toggle" aria-pressed="${!!one.done}" aria-label="${one.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>
      <button type="button" class="one-text" data-action="one-edit" aria-label="Edit: ${esc(one.text)}">${esc(one.text)}</button>
    </div>
  </section>`;
}

function rings(app) {
  const rec = app.dayRec();
  const goals = app.state.settings.goals;
  const salah = prayedCount(rec);
  const quran = rec.quran || 0;
  const dhikr = rec.dhikr || 0;
  const closed = salah >= 5 && quran >= goals.quran && dhikr >= goals.dhikr;
  const run = streak(app.state.days, app.ctx.key);
  const note = closed ? 'All three closed. MashaAllah.' : run ? `${run}-day salah streak` : 'Close all three today';
  const size = 116;
  return `<section class="block rings">
    <div class="rings-head">
      <p class="eyebrow">Daily rings</p>
      <p class="rings-note">${note}</p>
    </div>
    <div class="rings-body">
      <svg viewBox="0 0 ${size} ${size}" class="rings-svg" aria-hidden="true">
        ${ring({ r: 51, stroke: 10, value: salah / 5, cls: 'r-salah', size })}
        ${ring({ r: 38, stroke: 10, value: quran / goals.quran, cls: 'r-quran', size })}
        ${ring({ r: 25, stroke: 10, value: dhikr / goals.dhikr, cls: 'r-dhikr', size })}
      </svg>
      <dl class="rings-legend">
        <div class="rl"><dt><span class="sw r-salah"></span>Salah</dt><dd><span>${salah}<small>/5</small></span></dd></div>
        <div class="rl"><dt><span class="sw r-quran"></span>Quran</dt><dd><span>${quran}<small>/${goals.quran} pages</small></span>
          <span class="stepper">
            <button type="button" class="icon-btn sm" data-action="quran" data-delta="-1" aria-label="One page less">${icon('minus')}</button>
            <button type="button" class="icon-btn sm" data-action="quran" data-delta="1" aria-label="One page more">${icon('plus')}</button>
          </span></dd></div>
        <div class="rl"><dt><span class="sw r-dhikr"></span>Dhikr</dt><dd><span>${dhikr}<small>/${goals.dhikr}</small></span>
          <button type="button" class="link-btn" data-action="tab" data-tab="dhikr">Count ${icon('chevron')}</button></dd></div>
      </dl>
    </div>
  </section>`;
}

function idea(c) {
  const w = c.wisdom;
  return `<section class="block idea">
    <div class="idea-head">
      <p class="eyebrow">${SOURCES[w.t]}</p>
      <button type="button" class="ghost-btn" data-action="share-idea">${icon('share')}Share</button>
    </div>
    <blockquote class="idea-quote">${esc(w.q)}</blockquote>
    <p class="idea-by">${esc(w.by)}</p>
    <p class="idea-do"><span class="idea-do-label">Try today</span>${esc(w.do)}</p>
  </section>`;
}

export function renderToday(app) {
  const c = app.ctx;
  const loc = app.state.settings.loc;
  return `<header class="topbar">
      <button type="button" class="loc-btn" data-action="sheet" data-sheet="location">${icon('pin')}<span>${esc(loc.name)}</span></button>
      <div class="topbar-actions">
        <button type="button" class="icon-btn" data-action="sheet" data-sheet="qibla" aria-label="Qibla direction">${icon('kaaba')}</button>
        <button type="button" class="icon-btn" data-action="sheet" data-sheet="settings" aria-label="Settings">${icon('sliders')}</button>
      </div>
    </header>
    ${hero(app)}
    ${nudge(c)}
    ${oneThing(app)}
    ${rings(app)}
    ${idea(c)}`;
}
