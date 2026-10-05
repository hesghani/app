// Functions the sync engine runs inside a merch.amazon.com tab, in the page's
// own JavaScript world (chrome.scripting.executeScript with world: 'MAIN').
// Requests made here carry the signed-in Merch session and the page's origin,
// exactly like Merch's own requests.
//
// Each function is serialized and injected on its own, so it must not use
// anything from outside its body: no imports, no shared helpers.

export interface Wire {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  /** Add every anti-forgery header the page has used, not just refresh the ones present. */
  addTokens?: boolean;
}

export interface WireResult {
  status: number;
  finalUrl: string;
  text: string | null;
  type: string;
  ms: number;
  error?: string;
}

/** Runs requests with a small worker pool. Every request has its own timeout. */
export async function pageFetch(reqs: Wire[], timeoutMs: number, concurrency: number): Promise<WireResult[]> {
  const w = window as unknown as Record<string, unknown>;
  const raw = (w.__loupeRawFetch as typeof fetch | undefined) ?? window.fetch.bind(window);
  const tokens = (w.__loupeTokens as Record<string, string> | undefined) ?? {};
  const out: WireResult[] = new Array(reqs.length);
  let next = 0;

  const one = async (r: Wire): Promise<WireResult> => {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { ...r.headers };
      const names = Object.keys(headers).map((k) => k.toLowerCase());
      for (const [k, v] of Object.entries(tokens)) {
        const i = names.indexOf(k.toLowerCase());
        if (i >= 0) headers[Object.keys(headers)[i]!] = v;
        else if (r.addTokens) headers[k] = v;
      }
      const res = await raw(r.url, {
        method: r.method,
        headers,
        body: r.method === 'GET' || r.method === 'HEAD' ? undefined : r.body,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      const type = res.headers.get('content-type') ?? '';
      let text: string | null = await res.text();
      if (text.length > 25_000_000) text = null;
      return { status: res.status, finalUrl: res.url, text, type, ms: Date.now() - started };
    } catch (e) {
      const name = (e as Error)?.name;
      return { status: 0, finalUrl: r.url, text: null, type: '', ms: Date.now() - started, error: name === 'AbortError' ? 'timeout' : String((e as Error)?.message ?? e) };
    } finally {
      clearTimeout(timer);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, reqs.length)) }, async () => {
    while (next < reqs.length) {
      const i = next++;
      out[i] = await one(reqs[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface PageInfo {
  url: string;
  signin: boolean;
  tokens: Record<string, string>;
  scripts: string[];
  requests: string[];
  embedded: Array<{ source: string; text: string }>;
  links: Array<{ href: string; text: string }>;
}

/** What the current page knows: anti-forgery tokens, its scripts, the data requests it made, data embedded in the HTML. */
export function pageInfo(): PageInfo {
  const w = window as unknown as Record<string, unknown>;
  const tokens: Record<string, string> = { ...((w.__loupeTokens as Record<string, string> | undefined) ?? {}) };
  document.querySelectorAll('meta[name], input[type="hidden"][name]').forEach((el) => {
    const name = el.getAttribute('name') ?? '';
    const value = (el as HTMLMetaElement).content ?? (el as HTMLInputElement).value ?? '';
    if (/csrf|xsrf/i.test(name) && value && value.length < 512 && !tokens[name]) tokens[name] = value;
  });

  const scripts = new Set<string>();
  document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((s) => scripts.add(s.src));
  const requests: string[] = [];
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    if (e.initiatorType === 'script' || /\.js(?:\?|$)/.test(e.name)) scripts.add(e.name);
    else if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') requests.push(e.name);
  }

  const embedded: Array<{ source: string; text: string }> = [];
  document.querySelectorAll('script:not([src])').forEach((s, i) => {
    const type = (s.getAttribute('type') ?? '').toLowerCase();
    const text = s.textContent ?? '';
    if (text.length < 30 || text.length > 8_000_000) return;
    if (type.includes('json') || type === 'a-state' || s.hasAttribute('data-a-state')) {
      embedded.push({ source: `script[${type || 'data-a-state'}]#${i}`, text });
      return;
    }
    const m = /^\s*(?:window\.|var\s+|let\s+|const\s+)?([A-Za-z_$][\w$.]*)\s*=\s*([[{][\s\S]*[\]}])\s*;?\s*$/.exec(text);
    if (m) embedded.push({ source: m[1]!, text: m[2]! });
  });

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((a) => a.href.startsWith(location.origin))
    .map((a) => ({ href: a.href.split('#')[0]!, text: (a.textContent ?? '').trim().slice(0, 60) }))
    .slice(0, 200);

  const signin = /\/ap\/(?:signin|mfa|cvf)/.test(location.pathname) || Boolean(document.querySelector('form[name="signIn"], #ap_email, #ap_password'));
  return { url: location.href, signin, tokens, scripts: Array.from(scripts).slice(0, 120), requests: requests.slice(-300), embedded: embedded.slice(0, 40), links };
}

/** Reads Merch's own scripts and returns the API-like paths written in them. */
export async function pageScan(urls: string[], timeoutMs: number): Promise<{ paths: string[]; read: number; failed: number; failedUrls: string[] }> {
  const w = window as unknown as Record<string, unknown>;
  const raw = (w.__loupeRawFetch as typeof fetch | undefined) ?? window.fetch.bind(window);
  const found = new Set<string>();
  const literal = /["'`]((?:https:\/\/[a-z0-9.-]+)?\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_${}:.-]+)+\/?)(?:\?[^"'`\s]{0,200})?["'`]/g;
  const keep = /api|report|sale|purchase|royalt|earning|analy|merchandise|product|design|listing|catalog|account|summary|graphql|search|dashboard|tier/i;
  const skip = /\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ico|map|html?)$/i;
  let read = 0;
  let failed = 0;
  const failedUrls: string[] = [];
  let next = 0;
  const one = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const sameOrigin = url.startsWith(location.origin);
      const res = await raw(url, { credentials: sameOrigin ? 'include' : 'omit', mode: sameOrigin ? 'same-origin' : 'cors', signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      read += 1;
      if (text.length > 15_000_000) return;
      for (const m of text.matchAll(literal)) {
        const path = m[1]!;
        if (path.length > 160 || skip.test(path) || !keep.test(path)) continue;
        if (/^https:\/\//.test(path) && !/amazon|a2z/.test(path)) continue;
        found.add(path);
        if (found.size > 600) return;
      }
    } catch {
      failed += 1;
      failedUrls.push(url);
    } finally {
      clearTimeout(timer);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (next < urls.length) await one(urls[next++]!);
  }));
  return { paths: Array.from(found).sort(), read, failed, failedUrls };
}
