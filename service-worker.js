const CACHE_NAME = 'tps1-lead-manager-v35';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './bg.png',
  './css/style.css?v=21',
  './js/supabase.js',
  './js/app.js',
  './js/data.js',
  './js/kanban.js',
  './js/quote.js',
  './js/sheets.js',
  './js/charts.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow fallback if some files don't exist yet during install
      return cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => console.log('Error caching assets during install:', err));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests and local/same-origin fetches to avoid caching Google Sheet exports or CDNs excessively
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Silent catch for network failure
      });

      return cachedResponse || fetchPromise;
    })
  );
});
