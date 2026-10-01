import { icon } from '../ui/icons.js';
import { esc } from '../ui/dom.js';
import { METHODS, qiblaBearing, distanceKm, KAABA } from '../lib/praytimes.js';
import { resolveSettings } from '../core.js';
import { searchCities, citiesInZone } from '../data/cities.js';
import { hijriFromYmd, hijriLabel } from '../lib/hijri.js';
import { deviceTimeZone } from '../lib/time.js';

const head = (title) =>
  `<div class="sheet-head"><h2>${title}</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="Close">${icon('close')}</button></div>`;

const seg = (name, value, options) =>
  `<div class="seg sm" role="radiogroup" aria-label="${name}">${options
    .map(
      ([v, label]) =>
        `<button type="button" role="radio" aria-checked="${String(value) === String(v)}" data-action="set" data-key="${name}" data-value="${v}">${label}</button>`,
    )
    .join('')}</div>`;

export function cityItems(list) {
  if (!list.length) return '<li class="city-empty">No match in the built-in list. Use your location, or enter coordinates below.</li>';
  return list
    .map(
      (c) =>
        `<li><button type="button" class="city" data-action="pick-city" data-name="${esc(c.name)}" data-country="${esc(c.country)}">
          <span>${esc(c.name)}</span><small>${esc(c.country)}</small></button></li>`,
    )
    .join('');
}

// Results for a query, or one-tap suggestions from the device's time zone when empty.
export function cityResults(query = '') {
  const q = query.trim();
  if (q) return cityItems(searchCities(q));
  const near = citiesInZone(deviceTimeZone()).slice(0, 6);
  return near.length ? cityItems(near) : '';
}

export function cityPicker(query = '') {
  const hasNear = citiesInZone(deviceTimeZone()).length > 0;
  return `<div class="field">
      <label class="eyebrow" for="city-q">${hasNear ? 'Pick a nearby city, or search' : 'Search a city'}</label>
      <input id="city-q" type="search" autocomplete="off" placeholder="City or country" value="${esc(query)}" data-input="city">
    </div>
    <ul class="city-list" data-live="cities">${cityResults(query)}</ul>`;
}

export function locationSheet(app) {
  const loc = app.state.settings.loc;
  return `${head('Location')}
    ${loc ? `<p class="sheet-sub">Now: ${esc(loc.name)}${loc.country ? `, ${esc(loc.country)}` : ''} · ${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)}</p>` : ''}
    <button type="button" class="btn primary wide" data-action="gps">${icon('locate')}Use my current location</button>
    ${cityPicker(app.ui.cityQuery)}
    <details class="coords">
      <summary>Enter coordinates</summary>
      <form data-submit="coords" class="coords-form">
        <div class="field"><label for="lat">Latitude</label><input id="lat" name="lat" inputmode="decimal" placeholder="51.5074" required></div>
        <div class="field"><label for="lng">Longitude</label><input id="lng" name="lng" inputmode="decimal" placeholder="-0.1278" required></div>
        <button class="btn">Use these</button>
      </form>
      <p class="fine">Uses this device’s time zone (${esc(deviceTimeZone())}).</p>
    </details>`;
}

export function settingsSheet(app) {
  const s = app.state.settings;
  const r = resolveSettings(s);
  const m = METHODS[r.method];
  const hijri = hijriLabel(hijriFromYmd(app.ctx.today, s.hijriOffset));
  const finishDays = Math.ceil(604 / s.goals.quran);
  const methodOptions = [
    `<option value="auto"${s.method === 'auto' ? ' selected' : ''}>Auto · ${esc(METHODS[r.method].name)}</option>`,
    ...Object.entries(METHODS).map(
      ([id, def]) => `<option value="${id}"${s.method === id ? ' selected' : ''}>${esc(def.name)}</option>`,
    ),
  ].join('');
  const ishaText = typeof m.isha === 'string' ? `Isha ${m.isha.replace(' min', ' min after Maghrib')}` : `Isha at ${m.isha}°`;

  return `${head('Settings')}
    <div class="set-group">
      <button type="button" class="set-row" data-action="sheet" data-sheet="location">
        <span>Location</span><span class="set-val">${esc(s.loc.name)}${icon('chevron')}</span>
      </button>
      <div class="set-row col">
        <label for="set-method">Calculation method</label>
        <select id="set-method" data-change="method">${methodOptions}</select>
        <small>Fajr when the sun is ${m.fajr}° below the horizon. ${ishaText}.</small>
      </div>
      <div class="set-row"><span>Asr</span>${seg('asr', r.asr, [
        ['standard', 'Standard'],
        ['hanafi', 'Hanafi'],
      ])}</div>
      <div class="set-row"><span>Hijri date<small>${esc(hijri)}</small></span>
        <span class="stepper">
          <button type="button" class="icon-btn sm" data-action="hijri" data-delta="-1" aria-label="One day earlier">${icon('minus')}</button>
          <span class="stepper-val">${s.hijriOffset > 0 ? '+' : ''}${s.hijriOffset}</span>
          <button type="button" class="icon-btn sm" data-action="hijri" data-delta="1" aria-label="One day later">${icon('plus')}</button>
        </span>
      </div>
    </div>

    <div class="set-group">
      <div class="set-row"><span>Quran goal<small>${s.goals.quran} pages a day finishes the Quran in ${finishDays} days</small></span>
        <span class="stepper">
          <button type="button" class="icon-btn sm" data-action="goal" data-goal="quran" data-delta="-1" aria-label="Fewer pages">${icon('minus')}</button>
          <span class="stepper-val">${s.goals.quran}</span>
          <button type="button" class="icon-btn sm" data-action="goal" data-goal="quran" data-delta="1" aria-label="More pages">${icon('plus')}</button>
        </span>
      </div>
      <div class="set-row"><span>Dhikr goal</span>${seg('dhikrGoal', s.goals.dhikr, [
        [33, '33'],
        [100, '100'],
        [300, '300'],
        [1000, '1k'],
      ])}</div>
    </div>

    <div class="set-group">
      <div class="set-row"><span>Clock</span>${seg('clock', r.h12 ? '12' : '24', [
        ['12', '12h'],
        ['24', '24h'],
      ])}</div>
      <div class="set-row"><span>Theme</span>${seg('theme', s.theme, [
        ['system', 'Auto'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ])}</div>
    </div>

    <div class="set-group">
      <button type="button" class="set-row" data-action="alerts" role="switch" aria-checked="${s.alerts}">
        <span>Prayer alerts<small>Notifies you while Ihsan is open or in the background</small></span>
        <span class="switch" aria-hidden="true"></span>
      </button>
      <button type="button" class="set-row" data-action="ics">
        <span>Add the next 30 days to my calendar<small>An alarm at every prayer, on any phone, even when Ihsan is closed</small></span>
        ${icon('calendar')}
      </button>
    </div>

    <div class="set-group">
      <button type="button" class="set-row" data-action="export"><span>Export my data</span>${icon('download')}</button>
      <button type="button" class="set-row" data-action="import"><span>Import a backup</span>${icon('upload')}</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <button type="button" class="set-row danger" data-action="erase">
        <span>${app.ui.eraseArmed ? 'Tap again to erase everything' : 'Erase all data'}</span>
      </button>
    </div>

    <p class="about"><strong>Ihsan</strong> keeps everything on this device. No account, no tracking, no ads.</p>`;
}

export function qiblaSheet(app) {
  const { lat, lng } = app.state.settings.loc;
  const bearing = qiblaBearing(lat, lng);
  const km = Math.round(distanceKm(lat, lng, KAABA.lat, KAABA.lng));
  const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const major = i % 6 === 0;
    return `<line x1="120" y1="${major ? 14 : 18}" x2="120" y2="24" transform="rotate(${i * 5} 120 120)" class="${major ? 'tick-major' : 'tick'}"/>`;
  }).join('');
  const letters = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    ['W', 270],
  ]
    .map(([l, a]) => `<text x="120" y="42" text-anchor="middle" transform="rotate(${a} 120 120)" class="dial-letter${l === 'N' ? ' is-north' : ''}">${l}</text>`)
    .join('');

  return `${head('Qibla')}
    <div class="compass" data-live="compass" data-bearing="${bearing.toFixed(2)}">
      <span class="compass-pointer" aria-hidden="true"></span>
      <svg viewBox="0 0 240 240" class="dial" aria-hidden="true">
        <circle cx="120" cy="120" r="108" class="dial-face"/>
        ${ticks}${letters}
        <g transform="rotate(${bearing.toFixed(2)} 120 120)">
          <line x1="120" y1="120" x2="120" y2="66" class="qibla-line"/>
          <g transform="translate(110 46)" class="qibla-mark">
            <rect width="20" height="20" rx="2.5"/><rect y="5" width="20" height="3" class="qibla-band"/>
          </g>
        </g>
        <circle cx="120" cy="120" r="4" class="dial-hub"/>
      </svg>
    </div>
    <p class="qibla-deg"><strong>${bearing.toFixed(1)}°</strong> from north, towards ${compass}</p>
    <p class="qibla-status" data-live="qibla-status">${km.toLocaleString('en')} km to the Kaaba</p>
    <button type="button" class="btn wide" data-action="compass">${icon('kaaba')}Use phone compass</button>
    <p class="fine">Hold your phone flat and away from metal. Turn until the Kaaba reaches the top marker. Without a compass, line up N with true north.</p>`;
}

export function shareSheet(url, canShare) {
  return `${head('Share today’s idea')}
    <img class="share-img" src="${url}" alt="Story card with today’s idea">
    <div class="share-actions">
      ${canShare ? `<button type="button" class="btn primary" data-action="share-native">${icon('share')}Share</button>` : ''}
      <button type="button" class="btn" data-action="share-save">${icon('download')}Save image</button>
    </div>
    <p class="fine">Or long-press the image to save it.</p>`;
}
