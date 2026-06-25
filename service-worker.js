// SERVICE WORKER v38 - CACHE BUSTER + AUTO RELOAD
// Xóa toàn bộ cache độc và tự động reload tất cả tabs

const CACHE_NAME = 'tps1-v38';

self.addEventListener('install', (e) => {
  // Kích hoạt ngay lập tức, không chờ tab cũ đóng
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // 1. Xóa TẤT CẢ cache cũ
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        // 2. Tự động reload tất cả tabs để fetch HTML thật từ server
        clients.forEach((client) => {
          client.navigate(client.url);
        });
      })
  );
});

// Pass-through: không cache gì cả
self.addEventListener('fetch', () => {});
