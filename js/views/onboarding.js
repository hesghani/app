import { icon } from '../ui/icons.js';
import { cityPicker } from './sheets.js';

export function renderOnboarding(app) {
  return `<main class="onboard sky">
    <div class="onboard-inner">
      <p class="wordmark">ihsan</p>
      <h1 class="onboard-title">Build your day around the five.</h1>
      <ul class="onboard-points">
        <li><strong>Pray on time.</strong> A live countdown to every prayer, wherever you are.</li>
        <li><strong>Focus between prayers.</strong> Each prayer closes a block of deep work.</li>
        <li><strong>One intention, one review.</strong> Set it in the morning, check it at night.</li>
      </ul>
      <div class="onboard-card">
        <button type="button" class="btn primary wide" data-action="gps">${icon('locate')}Use my location</button>
        ${cityPicker(app.ui.cityQuery)}
      </div>
      <p class="fine">Everything stays on this device. No account needed.</p>
    </div>
  </main>`;
}
