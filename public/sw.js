const CACHE = 'hamiya-shell-v5';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});
// Identity, documents, orders and authenticated API responses are never cached.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api')
  )
    return;
  if (event.request.mode === 'navigate') {
    // The HTML shell contains no customer data. Never retain callback query tokens.
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put('/', response.clone());
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match('/')) ||
            new Response('Please reconnect to open Hamiya.', { status: 503 }),
        ),
    );
    return;
  }
  if (
    url.pathname.startsWith('/assets/') ||
    ['/icon.svg', '/manifest.webmanifest'].includes(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
  }
});
