// Runs in the page's own JavaScript world on merch.amazon.com (every frame),
// before Merch's scripts. It observes the data Merch's pages load with your
// signed-in session (fetch and XHR, any amazon.com API host) and hands a copy,
// with the request that produced it, to Loupe's isolated content script.
// Nothing is modified and nothing leaves the browser.

(() => {
  const FLAG = '__loupeCapture';
  const w = window as unknown as Record<string, unknown>;
  if (w[FLAG]) return;
  w[FLAG] = true;

  const MAX_CHARS = 12 * 1024 * 1024;
  const origin = location.origin;
  const TELEMETRY = /^(?:fls-|unagi|aax|aan\.|aws-?metrics|metrics|csm|sentry)/i;

  const eligible = (raw: string): string | null => {
    try {
      const u = new URL(raw, location.href);
      if (u.protocol !== 'https:') return null;
      if (!/(^|\.)amazon\.(?:com|co\.uk|de|fr|it|es|co\.jp)$/.test(u.hostname)) return null;
      if (TELEMETRY.test(u.hostname)) return null;
      if (/\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ico|map|html?)$/i.test(u.pathname)) return null;
      return u.href;
    } catch {
      return null;
    }
  };

  /** JSON text, minus Angular's XSSI prefix; null when it isn't JSON. */
  const jsonText = (text: string): string | null => {
    const t = text.replace(/^\)\]\}',?\s*/, '').trimStart();
    return t.startsWith('{') || t.startsWith('[') ? t : null;
  };

  // Captures wait until the isolated script says it's listening.
  let ready = false;
  const buffer: Array<Record<string, unknown>> = [];
  const deliver = (message: Record<string, unknown>) => {
    try {
      window.postMessage({ __loupe: 'capture', ...message }, origin);
    } catch {
      /* uncloneable payloads are skipped */
    }
  };
  const post = (message: Record<string, unknown>) => {
    if (ready) deliver(message);
    else if (buffer.push(message) > 40) buffer.shift();
  };

  const headersToObject = (headers: HeadersInit | undefined): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!headers) return out;
    try {
      new Headers(headers).forEach((value, key) => {
        if (!/^(?:cookie|content-length|host)$/i.test(key)) out[key] = value;
      });
    } catch {
      /* ignore malformed headers */
    }
    return out;
  };

  const bodyText = (body: unknown): string | undefined => {
    if (typeof body === 'string') return body.length < 200_000 ? body : undefined;
    if (body instanceof URLSearchParams) return body.toString();
    return undefined;
  };

  // ---- fetch ----
  const originalFetch = window.fetch;
  window.fetch = async function patchedFetch(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    let reqBody: string | undefined;
    const isRequest = typeof Request !== 'undefined' && input instanceof Request;
    try {
      reqBody = bodyText(init?.body);
      if (reqBody === undefined && isRequest && (input as Request).method !== 'GET') {
        reqBody = await (input as Request).clone().text().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
    const response = await originalFetch.call(this ?? window, input, init);
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      const url = eligible(raw);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (url && length <= MAX_CHARS && !/image|font|javascript|css|html/i.test(response.headers.get('content-type') ?? '')) {
        const method = (init?.method ?? (isRequest ? (input as Request).method : 'GET')).toUpperCase();
        const headers = headersToObject(init?.headers ?? (isRequest ? (input as Request).headers : undefined));
        response
          .clone()
          .text()
          .then((text) => {
            const json = text.length <= MAX_CHARS ? jsonText(text) : null;
            if (json) post({ url, method, status: response.status, body: json, reqHeaders: headers, reqBody });
          })
          .catch(() => undefined);
      }
    } catch {
      /* never break the page */
    }
    return response;
  } as typeof window.fetch;

  // ---- XMLHttpRequest ----
  interface Tracked { __loupe?: { method: string; url: string; headers: Record<string, string> } }
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const setHeader = proto.setRequestHeader;
  const send = proto.send;

  proto.open = function (this: XMLHttpRequest & Tracked, method: string, url: string | URL, ...rest: unknown[]) {
    this.__loupe = { method: String(method).toUpperCase(), url: String(url), headers: {} };
    return (open as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;

  proto.setRequestHeader = function (this: XMLHttpRequest & Tracked, name: string, value: string) {
    if (this.__loupe && !/^(?:cookie|content-length|host)$/i.test(name)) this.__loupe.headers[name] = value;
    return setHeader.call(this, name, value);
  };

  proto.send = function (this: XMLHttpRequest & Tracked, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = this.__loupe;
    const url = meta ? eligible(meta.url) : null;
    if (meta && url) {
      const reqBody = bodyText(body);
      this.addEventListener('load', () => {
        try {
          if (/image|font|javascript|css|html/i.test(this.getResponseHeader('content-type') ?? '')) return;
          const base = { url, method: meta.method, status: this.status, reqHeaders: meta.headers, reqBody };
          if (this.responseType === 'json') {
            if (this.response && typeof this.response === 'object') post({ ...base, json: this.response });
          } else if (this.responseType === '' || this.responseType === 'text') {
            const json = this.responseText.length <= MAX_CHARS ? jsonText(this.responseText) : null;
            if (json) post({ ...base, body: json });
          }
        } catch {
          /* never break the page */
        }
      });
    }
    return send.call(this, body);
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== origin) return;
    if ((event.data as { __loupe?: string })?.__loupe === 'ready' && !ready) {
      ready = true;
      buffer.splice(0).forEach(deliver);
    }
  });
})();
