// Runs in the page's own JavaScript world on merch.amazon.com, before the
// dashboard's scripts. It observes the JSON the dashboard loads (fetch and
// XHR) and hands a copy to Loupe's isolated content script. Nothing is
// modified and nothing leaves the browser.

(() => {
  const FLAG = '__loupeCapture';
  const w = window as unknown as Record<string, unknown>;
  if (w[FLAG]) return;
  w[FLAG] = true;

  const MAX_BYTES = 8 * 1024 * 1024;
  const origin = location.origin;

  const eligible = (url: string): boolean => {
    try {
      const u = new URL(url, origin);
      return u.origin === origin && !/\.(?:js|css|png|jpe?g|gif|svg|woff2?|ico|map)$/i.test(u.pathname);
    } catch {
      return false;
    }
  };

  // The dashboard can load data before Loupe's isolated script is listening,
  // so captures are held until it says it's ready.
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
    else if (buffer.push(message) > 30) buffer.shift();
  };

  const headersToObject = (headers: HeadersInit | undefined): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!headers) return out;
    try {
      new Headers(headers).forEach((value, key) => {
        if (!/^(?:cookie|content-length)$/i.test(key)) out[key] = value;
      });
    } catch {
      /* ignore malformed headers */
    }
    return out;
  };

  // ---- fetch ----
  const originalFetch = window.fetch;
  window.fetch = async function patchedFetch(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch.call(this ?? window, input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const type = response.headers.get('content-type') ?? '';
      const length = Number(response.headers.get('content-length') ?? 0);
      if (eligible(url) && /json/i.test(type) && length <= MAX_BYTES) {
        const headers = headersToObject(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        response
          .clone()
          .text()
          .then((body) => {
            if (body.length <= MAX_BYTES) post({ url: new URL(url, origin).href, method, status: response.status, body, headers });
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
    if (this.__loupe && !/^(?:cookie|content-length)$/i.test(name)) this.__loupe.headers[name] = value;
    return setHeader.call(this, name, value);
  };

  proto.send = function (this: XMLHttpRequest & Tracked, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = this.__loupe;
    if (meta && eligible(meta.url)) {
      this.addEventListener('load', () => {
        try {
          const type = this.getResponseHeader('content-type') ?? '';
          if (!/json/i.test(type)) return;
          const url = new URL(meta.url, origin).href;
          if (this.responseType === 'json') post({ url, method: meta.method, status: this.status, json: this.response, headers: meta.headers });
          else if (this.responseType === '' || this.responseType === 'text') {
            if (this.responseText.length <= MAX_BYTES) post({ url, method: meta.method, status: this.status, body: this.responseText, headers: meta.headers });
          }
        } catch {
          /* never break the page */
        }
      });
    }
    return send.call(this, body);
  };

  // ---- Replay: re-run requests that returned sales data, on Loupe's request ----
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data as { __loupe?: string; requests?: Array<{ url: string; headers: Record<string, string> }> };
    if (data?.__loupe === 'ready' && !ready) {
      ready = true;
      buffer.splice(0).forEach(deliver);
      return;
    }
    if (data?.__loupe !== 'replay' || !Array.isArray(data.requests)) return;
    for (const request of data.requests.slice(0, 10)) {
      if (!eligible(request.url)) continue;
      window.fetch(request.url, { credentials: 'include', headers: request.headers }).catch(() => undefined);
    }
  });
})();
