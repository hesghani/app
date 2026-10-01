export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported on this device.
  }
}

let toastTimer;
export function toast(message) {
  const el = $('#toast');
  if (!el) return;
  // An open <dialog> sits in the top layer; keep the toast visible above it.
  const host = document.querySelector('dialog[open]') ?? document.body;
  if (el.parentElement !== host) host.append(el);
  el.textContent = message;
  el.hidden = false;
  el.classList.remove('is-out');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => (el.hidden = true), 250);
  }, 2600);
}

// Resolves true when the file was handed over. Inside a claude.ai preview the host
// mediates saves; everywhere else a plain download link does the job.
export async function download(blob, filename) {
  const host = globalThis.claude?.use ? await globalThis.claude.use('downloads').catch(() => null) : null;
  if (host) {
    try {
      await host.save({ filename, data: blob });
      return true;
    } catch (e) {
      if (e?.code !== 'declined') {
        toast(e?.code === 'rejected_extension' ? 'This preview can’t save that file type. Install Ihsan to use it.' : 'Saving isn’t available here.');
      }
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

// SVG ring geometry shared by the daily rings, focus timer and dhikr counter.
export function ring({ r, stroke, value, cls, size }) {
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const mid = size / 2;
  return `<circle class="ring-track" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" fill="none"/>
    <circle class="ring-fill ${cls}" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" fill="none"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - v)).toFixed(2)}"
      transform="rotate(-90 ${mid} ${mid})" stroke-linecap="round" data-circ="${c.toFixed(2)}"/>`;
}

export function setRing(el, value) {
  if (!el) return;
  const c = parseFloat(el.dataset.circ);
  el.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, Math.min(1, value)))).toFixed(2));
}
