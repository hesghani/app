// Renders public/icons/icon{16,32,48,128}.png from the SVG below with the
// pre-installed Chromium. Run after changing the logo: node scripts/icons.mjs
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
await mkdir(out, { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6b5cff"/><stop offset="1" stop-color="#4334d4"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#g)"/>
  <circle cx="56" cy="56" r="29" fill="none" stroke="#fff" stroke-width="10"/>
  <path d="M78 78 L101 101" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
  <rect x="41" y="59" width="8" height="12" rx="2.5" fill="#fff"/>
  <rect x="52.5" y="51" width="8" height="20" rx="2.5" fill="#fff"/>
  <rect x="64" y="42" width="8" height="29" rx="2.5" fill="#fff"/>
</svg>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`);
  await page.screenshot({ path: join(out, `icon${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log(`Wrote icons to ${out}`);
