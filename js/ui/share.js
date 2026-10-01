// Renders today's idea as a 9:16 story card, painted with the current sky.

import { SOURCES } from '../data/wisdom.js';

export const SKIES = {
  night: ['#060A1C', '#0F1838', '#1F2B5C'],
  dawn: ['#161B47', '#45387A', '#A85A86', '#E2967A'],
  morning: ['#17508F', '#2F78BE', '#7FB0D6', '#E6BF8E'],
  noon: ['#0B4A9A', '#1E6FC4', '#4C9BE0'],
  afternoon: ['#213F78', '#7A5A7A', '#C77845', '#E3A158'],
  dusk: ['#160F33', '#4A2659', '#A3424F', '#DE7A45'],
};

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function storyCard(wisdom, period) {
  const W = 1080;
  const H = 1920;
  const pad = 110;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  try {
    await Promise.all([
      document.fonts.load('88px "Instrument Serif"'),
      document.fonts.load('italic 88px "Instrument Serif"'),
      document.fonts.load('500 36px "Geist"'),
    ]);
  } catch {
    // Fall back to system fonts.
  }
  const serif = '"Instrument Serif", Georgia, serif';
  const sans = '"Geist", system-ui, sans-serif';

  const stops = SKIES[period] ?? SKIES.night;
  const grad = g.createLinearGradient(0, 0, W * 0.35, H);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  if (period === 'night' || period === 'dusk') {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.25 + rand() * 0.6;
      g.beginPath();
      g.arc(rand() * W, rand() * H * 0.6, rand() * 2.2 + 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Measure first, then centre the whole block in the space above the wordmark.
  let size = 92;
  let lines;
  do {
    g.font = `${size}px ${serif}`;
    lines = wrap(g, `“${wisdom.q}”`, W - pad * 2);
    size -= 4;
  } while (lines.length * size * 1.18 > 820 && size > 52);
  size += 4;
  const lh = size * 1.18;
  g.font = `400 42px ${sans}`;
  const doLines = wrap(g, wisdom.do, W - pad * 2);
  const blockH = 60 + lines.length * lh + 30 + 50 + 120 + doLines.length * 60;
  let y = Math.max(260, (H - 300 - blockH) / 2 + 40);

  g.fillStyle = 'rgba(255,255,255,0.72)';
  g.font = `500 34px ${sans}`;
  g.fillText(SOURCES[wisdom.t].toUpperCase().split('').join('\u200a'), pad, y);
  y += 60 + size * 0.85;

  g.font = `${size}px ${serif}`;
  g.fillStyle = '#FFFFFF';
  for (const l of lines) {
    g.fillText(l, pad, y);
    y += lh;
  }

  y += 30;
  g.font = `500 38px ${sans}`;
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillText(wisdom.by, pad, y);

  y += 120;
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(pad, y - 50, 120, 3);
  g.font = `500 30px ${sans}`;
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.fillText('TRY TODAY', pad, y);
  g.font = `400 42px ${sans}`;
  g.fillStyle = '#FFFFFF';
  for (const l of doLines) {
    y += 60;
    g.fillText(l, pad, y);
  }

  g.font = `italic 76px ${serif}`;
  g.fillStyle = '#FFFFFF';
  g.fillText('ihsan', pad, H - 170);
  g.font = `400 32px ${sans}`;
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('Build your day around the five.', pad, H - 115);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
