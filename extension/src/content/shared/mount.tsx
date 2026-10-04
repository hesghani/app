// Mounts Preact UI inside a shadow root so Amazon's CSS can't reach it and
// ours can't leak out.

import { render, type ComponentChild } from 'preact';

export interface Mounted {
  host: HTMLElement;
  root: ShadowRoot;
  render: (vnode: ComponentChild) => void;
  remove: () => void;
}

export function mount(host: HTMLElement, css: string, vnode?: ComponentChild): Mounted {
  host.setAttribute('data-loupe', '');
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  if (!root.querySelector('style[data-loupe-css]')) {
    const style = document.createElement('style');
    style.setAttribute('data-loupe-css', '');
    style.textContent = css;
    root.appendChild(style);
  }
  let container = root.querySelector<HTMLElement>('div[data-loupe-root]');
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-loupe-root', '');
    root.appendChild(container);
  }
  const target = container;
  const api: Mounted = {
    host,
    root,
    render: (node) => render(node, target),
    remove: () => {
      render(null, target);
      host.remove();
    },
  };
  if (vnode !== undefined) api.render(vnode);
  return api;
}

export function createHost(tag = 'loupe-ui'): HTMLElement {
  return document.createElement(tag);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function download(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
