// Offline support: the app shell is cached on install, fonts are cached on first use.
const VERSION = 'ihsan-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/core.js',
  'js/lib/praytimes.js',
  'js/lib/time.js',
  'js/lib/hijri.js',
  'js/lib/nudges.js',
  'js/lib/stats.js',
  'js/lib/store.js',
  'js/lib/ics.js',
  'js/data/wisdom.js',
  'js/data/cities.js',
  'js/data/dhikr.js',
  'js/ui/icons.js',
  'js/ui/dom.js',
  'js/ui/share.js',
  'js/views/today.js',
  'js/views/focus.js',
  'js/views/dhikr.js',
  'js/views/reflect.js',
  'js/views/sheets.js',
  'js/views/onboarding.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  // Network first for our own files so updates land quickly; cache when offline.
  // Cache first for fonts, which never change.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      if (isFont) {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        cache.put(request, res.clone());
        return res;
      }
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('index.html'));
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('./');
    }),
  );
});
