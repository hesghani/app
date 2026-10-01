import * as store from './lib/store.js';
import { computeDay, timesFor, guessPeriod, NAMES } from './core.js';
import { PRAYERS } from './lib/praytimes.js';
import { addDays, countdown, deviceTimeZone, formatClock, weekdayOf, ymdKey } from './lib/time.js';
import { prayedCount, streak } from './lib/stats.js';
import { buildICS } from './lib/ics.js';
import { $, $$, toast, vibrate, download, setRing } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { storyCard } from './ui/share.js';
import { renderToday, arcSVG } from './views/today.js';
import { renderFocus, defaultFocusMode } from './views/focus.js';
import { renderDhikr, currentDhikr } from './views/dhikr.js';
import { renderReflect } from './views/reflect.js';
import { renderOnboarding } from './views/onboarding.js';
import { locationSheet, settingsSheet, qiblaSheet, shareSheet, cityResults } from './views/sheets.js';
import { CITIES, nearestCity } from './data/cities.js';

const TABS = [
  ['today', 'Today', renderToday],
  ['focus', 'Focus', renderFocus],
  ['dhikr', 'Dhikr', renderDhikr],
  ['reflect', 'Reflect', renderReflect],
];

const app = {
  state: store.load(),
  tab: 'today',
  ctx: null,
  sheet: null,
  ui: { editingOne: false, focusMode: null, focusDone: null, cityQuery: '', eraseArmed: false, share: null },
  save() {
    store.save(this.state);
  },
  dayRec() {
    return store.day(this.state, this.ctx.key);
  },
  clock(ms) {
    return formatClock(ms, this.ctx.tz, this.ctx.h12);
  },
};

const root = $('#app');
const tabbar = $('#tabs');
const sheetEl = $('#sheet');
const sheetBody = $('#sheet .sheet-body');

const fromHash = location.hash.slice(1);
if (TABS.some(([id]) => id === fromHash)) app.tab = fromHash;

// ---------- rendering ----------

let lastSig = '';
let lastArc = 0;
const signature = (c) =>
  [c.key, c.period, c.nextPrayer.id, c.nextPrayer.at, c.currentId, c.nudge?.text, c.ramadan?.mode, c.fajrEnds].join('|');

function refreshCtx() {
  app.ctx = app.state.settings.loc ? computeDay(app.state.settings) : null;
}

// Only touch data-theme when the user picked one, so a host page's own theme choice survives "Auto".
let appliedTheme = null;
function applyTheme() {
  const t = app.state.settings.theme;
  const rootEl = document.documentElement;
  if (t !== 'system') {
    rootEl.dataset.theme = t;
    appliedTheme = t;
  } else if (appliedTheme) {
    delete rootEl.dataset.theme;
    appliedTheme = null;
  }
}

function render() {
  applyTheme();
  refreshCtx();
  if (!app.ctx) {
    document.documentElement.dataset.period = guessPeriod();
    root.innerHTML = renderOnboarding(app);
    root.dataset.view = 'onboarding';
    tabbar.hidden = true;
    return;
  }
  document.documentElement.dataset.period = app.ctx.period;
  const view = TABS.find(([id]) => id === app.tab) ?? TABS[0];
  root.innerHTML = view[2](app);
  root.dataset.view = view[0];
  tabbar.hidden = false;
  tabbar.innerHTML = TABS.map(
    ([id, label]) =>
      `<button type="button" data-action="tab" data-tab="${id}"${id === app.tab ? ' aria-current="page"' : ''}>${icon(id)}<span>${label}</span>${
        id === 'focus' && app.state.focus ? '<i class="live-dot" aria-label="running"></i>' : ''
      }</button>`,
  ).join('');
  lastSig = signature(app.ctx);
  lastArc = app.ctx.now;
}

const isEditing = () => {
  const a = document.activeElement;
  return !!a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
};

function updateLive() {
  const now = app.ctx.now;
  for (const el of $$('[data-cd]')) el.textContent = countdown(Number(el.dataset.cd) - now);
  const f = app.state.focus;
  if (f && app.tab === 'focus') setRing($('.focus-stage .ring-fill'), (now - f.start) / (f.end - f.start));
  if (app.tab === 'today' && now - lastArc > 20000) {
    const arc = $('[data-live="arc"]');
    if (arc) arc.innerHTML = arcSVG(app.ctx);
    lastArc = now;
  }
}

function tick() {
  if (!app.state.settings.loc) return;
  refreshCtx();
  checkFocus();
  if (signature(app.ctx) !== lastSig && !isEditing()) {
    render();
    scheduleAlert();
  }
  updateLive();
}

// ---------- sheets ----------

const SHEETS = {
  settings: settingsSheet,
  location: locationSheet,
  qibla: qiblaSheet,
  share: () => shareSheet(app.ui.share.url, app.ui.share.canShare),
};

function openSheet(name) {
  app.sheet = name;
  sheetBody.innerHTML = SHEETS[name](app);
  sheetEl.dataset.sheet = name;
  if (!sheetEl.open) {
    try {
      sheetEl.showModal();
    } catch {
      sheetEl.setAttribute('open', '');
    }
  }
  sheetBody.scrollTop = 0;
}

function refreshSheet() {
  if (!app.sheet || !sheetEl.open) return;
  const scroll = sheetBody.scrollTop;
  sheetBody.innerHTML = SHEETS[app.sheet](app);
  sheetBody.scrollTop = scroll;
}

function closeSheet() {
  if (sheetEl.open) sheetEl.close();
  else onSheetClosed();
}

function onSheetClosed() {
  stopCompass();
  app.sheet = null;
  app.ui.cityQuery = '';
  app.ui.eraseArmed = false;
}

sheetEl.addEventListener('close', onSheetClosed);
sheetEl.addEventListener('click', (e) => {
  if (e.target === sheetEl) closeSheet();
});

// ---------- location ----------

function setLocation(loc) {
  app.state.settings.loc = loc;
  app.save();
  app.ui.cityQuery = '';
  closeSheet();
  render();
  scheduleAlert();
  toast(`Prayer times set for ${loc.name}.`);
}

function locateMe() {
  if (!navigator.geolocation) {
    toast('Location isn’t available here. Pick your city instead.');
    return;
  }
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = +pos.coords.latitude.toFixed(4);
      const lng = +pos.coords.longitude.toFixed(4);
      const { city, km } = nearestCity(lat, lng);
      const name = km < 40 ? city.name : km < 150 ? `Near ${city.name}` : 'Current location';
      setLocation({ name, country: km < 150 ? city.country : '', lat, lng, tz: deviceTimeZone() });
    },
    (err) => {
      toast(err.code === 1 ? 'Location is switched off for this app. Pick your city instead.' : 'Couldn’t find you. Pick your city instead.');
      $('#city-q')?.focus();
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 6 * 3600000 },
  );
}

// ---------- prayer alerts ----------

let alertTimer = null;
function scheduleAlert() {
  clearTimeout(alertTimer);
  alertTimer = null;
  const c = app.ctx;
  if (!c || !app.state.settings.alerts) return;
  const n = c.nextPrayer;
  const delay = n.at - Date.now();
  if (delay <= 0 || delay > 2147483000) return;
  alertTimer = setTimeout(() => {
    notify(`${NAMES[n.id]} · ${app.clock(n.at)}`, n.id === 'fajr' ? 'Prayer is better than sleep.' : 'Time to pray. Everything else can wait.');
  }, delay);
}

async function notify(title, body) {
  vibrate([30, 80, 30]);
  toast(title);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'ihsan' });
      return;
    }
  } catch {
    // Fall through to the page-level API.
  }
  try {
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch {
    // Notifications unavailable; the toast and vibration already fired.
  }
}

async function toggleAlerts() {
  const s = app.state.settings;
  if (s.alerts) {
    s.alerts = false;
  } else {
    if (!('Notification' in window)) {
      toast('This browser can’t show notifications. Add the prayer times to your calendar instead.');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = 'denied';
      }
    }
    if (perm !== 'granted') {
      toast('Notifications are blocked. Add the prayer times to your calendar instead.');
      return;
    }
    s.alerts = true;
    toast(`Alerts on. Next one at ${NAMES[app.ctx.nextPrayer.id]}.`);
  }
  app.save();
  refreshSheet();
  scheduleAlert();
}

async function exportCalendar() {
  const s = app.state.settings;
  const c = app.ctx;
  const events = [];
  for (let i = 0; i < 30; i++) {
    const ymd = addDays(c.today, i);
    const t = timesFor(ymd, s);
    const friday = weekdayOf(ymd) === 5;
    for (const id of PRAYERS) {
      if (t[id] != null && t[id] > Date.now()) events.push({ start: t[id], title: id === 'dhuhr' && friday ? 'Jumuʿah' : NAMES[id] });
    }
  }
  const ics = new Blob([buildICS(events, { name: `Prayer times · ${s.loc.name}` })], { type: 'text/calendar' });
  if (await download(ics, `ihsan-${ymdKey(c.today)}.ics`)) toast('Open the downloaded file to add 30 days of prayer alarms.');
}

// ---------- focus ----------

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

function splash(text) {
  const el = $('#splash');
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('is-on');
  void el.offsetWidth;
  el.classList.add('is-on');
  setTimeout(() => (el.hidden = true), 1500);
}

function startFocus() {
  const c = app.ctx;
  const now = Date.now();
  const mode = app.ui.focusMode ?? defaultFocusMode(c);
  // Every block ends at the adhan, even a fixed-length one.
  const capped = mode === 'prayer' || now + Number(mode) * 60000 >= c.nextPrayer.at;
  const end = capped ? c.nextPrayer.at : now + Number(mode) * 60000;
  if (end - now < 60000) {
    toast('Less than a minute until the prayer. Pray first.');
    return;
  }
  app.state.focus = { start: now, end, label: $('#focus-label')?.value.trim() ?? '', until: capped ? c.nextPrayer.id : null };
  app.ui.focusDone = null;
  app.save();
  keepAwake(true);
  vibrate(15);
  splash('Bismillah');
  render();
}

function finishFocus(reason) {
  const f = app.state.focus;
  if (!f) return;
  const end = Math.min(Date.now(), f.end);
  const min = Math.max(0, Math.round((end - f.start) / 60000));
  const rec = app.dayRec();
  rec.focus = (rec.focus || 0) + min;
  app.state.focus = null;
  app.ui.focusDone = { min, until: f.until, reason };
  app.save();
  keepAwake(false);
  if (reason === 'done' && Date.now() - f.end < 5 * 60000) {
    notify(f.until ? `${NAMES[f.until]} is in` : 'Block complete', `${min} minutes of deep work. Alhamdulillah.`);
  }
  render();
}

function checkFocus() {
  const f = app.state.focus;
  if (f && Date.now() >= f.end) finishFocus('done');
}

// ---------- dhikr ----------

function updateDhikrDom() {
  const { item, count } = currentDhikr(app.state);
  const counter = $('[data-live="dhikr-count"]');
  if (counter) counter.textContent = count;
  setRing($('.tap .ring-fill'), count / item.n);
  const today = $('[data-live="dhikr-today"]');
  if (today) today.textContent = app.dayRec().dhikr || 0;
  const tap = $('.tap');
  if (tap) {
    tap.setAttribute('aria-label', `Count ${item.tr}. ${count} of ${item.n}.`);
    tap.classList.remove('pulse');
    void tap.offsetWidth;
    tap.classList.add('pulse');
  }
}

function dhikrTap() {
  const st = app.state.dhikr;
  const restart = st.done;
  if (restart) Object.assign(st, { step: 0, count: 0, done: false });
  const { set, step, item } = currentDhikr(app.state);
  st.count += 1;
  const rec = app.dayRec();
  rec.dhikr = (rec.dhikr || 0) + 1;
  let changed = restart;
  if (st.count === item.n) {
    changed = true;
    if (step < set.steps.length - 1) {
      st.step += 1;
      st.count = 0;
      vibrate([25, 50, 25]);
    } else {
      st.done = true;
      vibrate([30, 60, 30, 60, 30]);
    }
  } else vibrate(8);
  app.save();
  if (changed) render();
  else updateDhikrDom();
}

// ---------- share ----------

async function shareIdea() {
  toast('Making your card…');
  const blob = await storyCard(app.ctx.wisdom, app.ctx.period);
  if (!blob) {
    toast('This device couldn’t make the image.');
    return;
  }
  if (app.ui.share?.url) URL.revokeObjectURL(app.ui.share.url);
  const file = new File([blob], 'ihsan-today.png', { type: 'image/png' });
  let canShare = false;
  try {
    canShare = !!navigator.canShare?.({ files: [file] });
  } catch {
    canShare = false;
  }
  app.ui.share = { url: URL.createObjectURL(blob), blob, file, canShare };
  openSheet('share');
}

// ---------- qibla compass ----------

let compassRot = 0;
let compassSeen = false;

function onOrient(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
  else if (e.absolute && e.alpha != null) h = 360 - e.alpha;
  if (h == null) return;
  compassSeen = true;
  h = (h + (screen.orientation?.angle || 0) + 360) % 360;
  const box = $('[data-live="compass"]');
  if (!box) return;
  const delta = ((-h - compassRot + 540) % 360) - 180;
  compassRot += delta;
  box.querySelector('.dial').style.transform = `rotate(${compassRot}deg)`;
  const bearing = Number(box.dataset.bearing);
  const off = ((bearing - h + 540) % 360) - 180;
  const aligned = Math.abs(off) < 4;
  if (aligned !== box.classList.contains('is-aligned')) {
    box.classList.toggle('is-aligned', aligned);
    if (aligned) vibrate(30);
  }
  const status = $('[data-live="qibla-status"]');
  if (status) status.textContent = aligned ? 'You are facing the Qibla.' : `Turn ${off > 0 ? 'right' : 'left'} ${Math.round(Math.abs(off))}°`;
}

async function startCompass() {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) {
    toast('No compass on this device. Line up N with true north.');
    return;
  }
  try {
    if (typeof DOE.requestPermission === 'function' && (await DOE.requestPermission()) !== 'granted') {
      toast('Compass access was declined.');
      return;
    }
  } catch {
    toast('The compass isn’t available here.');
    return;
  }
  stopCompass();
  compassSeen = false;
  window.addEventListener('deviceorientationabsolute', onOrient, true);
  window.addEventListener('deviceorientation', onOrient, true);
  toast('Compass on. Hold your phone flat.');
  setTimeout(() => {
    if (!compassSeen && app.sheet === 'qibla') toast('No compass reading. Line up N with true north instead.');
  }, 3000);
}

function stopCompass() {
  window.removeEventListener('deviceorientationabsolute', onOrient, true);
  window.removeEventListener('deviceorientation', onOrient, true);
  compassRot = 0;
}

// ---------- data ----------

async function exportData() {
  const blob = new Blob([JSON.stringify(app.state, null, 2)], { type: 'application/json' });
  if (await download(blob, `ihsan-backup-${app.ctx.key}.json`)) toast('Backup saved.');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || typeof data !== 'object' || typeof data.days !== 'object') throw new Error('not a backup');
      app.state = store.hydrate(data);
      app.save();
      closeSheet();
      render();
      scheduleAlert();
      toast('Backup restored.');
    } catch {
      toast('That file isn’t an Ihsan backup.');
    }
  };
  reader.readAsText(file);
}

function setOne(text) {
  const rec = app.dayRec();
  if (text) rec.one = { text, done: rec.one?.text === text ? !!rec.one.done : false };
  else delete rec.one;
  app.ui.editingOne = false;
  app.save();
}

// ---------- actions ----------

const actions = {
  tab(el) {
    if (app.tab !== el.dataset.tab) app.ui.focusDone = null;
    app.tab = el.dataset.tab;
    try {
      history.replaceState(null, '', `#${app.tab}`);
    } catch {
      // Some embedded viewers disallow history changes.
    }
    render();
    window.scrollTo({ top: 0 });
  },
  pray(el) {
    const rec = app.dayRec();
    const before = prayedCount(rec);
    rec.p[el.dataset.id] = rec.p[el.dataset.id] ? 0 : Date.now();
    app.save();
    vibrate(rec.p[el.dataset.id] ? 12 : 4);
    render();
    if (before < 5 && prayedCount(rec) === 5) {
      const s = streak(app.state.days, app.ctx.key);
      vibrate([20, 60, 20]);
      toast(s > 1 ? `All five. ${s} days in a row.` : 'All five prayers today. MashaAllah.');
    }
  },
  'one-toggle'() {
    const rec = app.dayRec();
    if (!rec.one) return;
    rec.one.done = !rec.one.done;
    app.save();
    vibrate(10);
    if (rec.one.done) toast('Done. That was the one that mattered.');
    render();
  },
  'one-edit'() {
    app.ui.editingOne = true;
    render();
    $('#one-input')?.focus();
  },
  quran(el) {
    const rec = app.dayRec();
    rec.quran = Math.max(0, (rec.quran || 0) + Number(el.dataset.delta));
    app.save();
    vibrate(6);
    render();
    if (Number(el.dataset.delta) > 0 && rec.quran === app.state.settings.goals.quran) toast('Quran goal done for today.');
  },
  sheet(el) {
    openSheet(el.dataset.sheet);
  },
  'close-sheet'() {
    closeSheet();
  },
  'share-idea'() {
    shareIdea();
  },
  async 'share-native'() {
    const w = app.ctx.wisdom;
    try {
      await navigator.share({ files: [app.ui.share.file], text: `“${w.q}” · ${w.by}` });
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Sharing didn’t work here. Save the image instead.');
    }
  },
  'share-save'() {
    download(app.ui.share.blob, 'ihsan-today.png');
  },
  'focus-mode'(el) {
    app.ui.focusMode = el.dataset.mode;
    render();
  },
  'focus-start'() {
    startFocus();
  },
  'focus-stop'() {
    finishFocus('stopped');
  },
  'focus-new'() {
    app.ui.focusDone = null;
    app.ui.focusMode = null;
    render();
  },
  'dhikr-sel'(el) {
    app.state.dhikr = { sel: el.dataset.id, step: 0, count: 0, done: false };
    app.save();
    render();
  },
  'dhikr-tap'() {
    dhikrTap();
  },
  'dhikr-undo'() {
    const st = app.state.dhikr;
    if (st.count <= 0 && !st.done) return;
    if (st.done) st.done = false;
    st.count = Math.max(0, st.count - 1);
    const rec = app.dayRec();
    rec.dhikr = Math.max(0, (rec.dhikr || 0) - 1);
    app.save();
    render();
  },
  'dhikr-reset'() {
    Object.assign(app.state.dhikr, { step: 0, count: 0, done: false });
    app.save();
    render();
  },
  gps() {
    locateMe();
  },
  'pick-city'(el) {
    const c = CITIES.find((x) => x.name === el.dataset.name && x.country === el.dataset.country);
    if (c) setLocation({ name: c.name, country: c.country, lat: c.lat, lng: c.lng, tz: c.tz });
  },
  set(el) {
    const s = app.state.settings;
    const { key, value } = el.dataset;
    if (key === 'dhikrGoal') s.goals.dhikr = Number(value);
    else s[key] = value;
    app.save();
    render();
    refreshSheet();
  },
  hijri(el) {
    const s = app.state.settings;
    s.hijriOffset = Math.max(-2, Math.min(2, s.hijriOffset + Number(el.dataset.delta)));
    app.save();
    render();
    refreshSheet();
  },
  goal(el) {
    const g = app.state.settings.goals;
    g.quran = Math.max(1, Math.min(40, g.quran + Number(el.dataset.delta)));
    app.save();
    render();
    refreshSheet();
  },
  alerts() {
    toggleAlerts();
  },
  ics() {
    exportCalendar();
  },
  export() {
    exportData();
  },
  import() {
    $('#import-file')?.click();
  },
  erase() {
    if (!app.ui.eraseArmed) {
      app.ui.eraseArmed = true;
      refreshSheet();
      setTimeout(() => {
        app.ui.eraseArmed = false;
        refreshSheet();
      }, 4000);
      return;
    }
    app.state = store.defaults();
    app.save();
    app.tab = 'today';
    closeSheet();
    render();
    toast('Everything has been erased.');
  },
  compass() {
    startCompass();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  const kind = form.dataset.submit;
  if (!kind) return;
  e.preventDefault();
  if (kind === 'one') {
    const text = form.elements.one.value.trim();
    setOne(text);
    document.activeElement?.blur();
    render();
    if (text) toast('Locked in. One thing.');
  }
  if (kind === 'coords') {
    const lat = parseFloat(form.elements.lat.value);
    const lng = parseFloat(form.elements.lng.value);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
      toast('Latitude must be between −90 and 90, longitude between −180 and 180.');
      return;
    }
    const { city, km } = nearestCity(lat, lng);
    setLocation({
      name: km < 40 ? city.name : `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      country: km < 40 ? city.country : '',
      lat,
      lng,
      tz: deviceTimeZone(),
    });
  }
});

// Leaving the intention field keeps what was typed, without re-rendering under the user's finger.
document.addEventListener('focusout', (e) => {
  if (e.target.id !== 'one-input') return;
  const text = e.target.value.trim();
  if (text) setOne(text);
});

let journalTimer;
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.input === 'city') {
    app.ui.cityQuery = t.value;
    const list = t.closest('.sheet-body, .onboard-card')?.querySelector('[data-live="cities"]');
    if (list) list.innerHTML = cityResults(t.value);
  }
  if (t.dataset.journal) {
    const rec = app.dayRec();
    rec.note = { ...rec.note, [t.dataset.journal]: t.value };
    const saved = $('[data-live="saved"]');
    if (saved) saved.textContent = '';
    clearTimeout(journalTimer);
    journalTimer = setTimeout(() => {
      app.save();
      if (saved) saved.textContent = 'Saved on this device';
    }, 500);
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.change === 'method') {
    app.state.settings.method = t.value;
    app.save();
    render();
    refreshSheet();
    toast('Prayer times updated.');
  }
  if (t.id === 'import-file' && t.files?.[0]) importData(t.files[0]);
});

document.addEventListener('keydown', (e) => {
  if (app.tab !== 'dhikr' || app.sheet || (e.key !== ' ' && e.key !== 'Enter')) return;
  if (e.target !== document.body) return;
  e.preventDefault();
  dhikrTap();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  tick();
  if (app.state.focus) keepAwake(true);
});

// ---------- boot ----------

render();
checkFocus();
scheduleAlert();
if (app.state.focus) keepAwake(true);
setInterval(tick, 1000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
