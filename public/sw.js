const CACHE = 'hamiya-shell-v7';
const BUILD_ASSETS = /* HAMIYA_BUILD_ASSETS */ [];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          '/',
          '/icon-192.png',
          '/icon-512.png',
          '/startup.css',
          '/boot.js',
          '/brand/hamiya-food-icon-192.png',
          '/fonts/Benaiah.ttf',
          '/brand/hamiya-food-icon-512.png',
          '/brand/hamiya-food-processing.jpg',
          '/brand/divisions/food.webp',
          '/brand/divisions/coffee.webp',
          '/brand/divisions/vehicles.webp',
          '/manifest.webmanifest',
          ...BUILD_ASSETS,
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Keep the previous build's chunks available to tabs already open during a release.
      const shells = keys.filter((key) => key.startsWith('hamiya-shell-'));
      return Promise.all(
        shells
          .slice(0, -2)
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key)),
      );
    }),
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
    url.pathname.startsWith('/fonts/') ||
    [
      '/icon-192.png',
      '/icon-512.png',
      '/startup.css',
      '/boot.js',
      '/brand/hamiya-food-icon-192.png',
      '/brand/hamiya-food-icon-512.png',
      '/brand/hamiya-food-processing.jpg',
      '/brand/divisions/food.webp',
      '/brand/divisions/coffee.webp',
      '/brand/divisions/vehicles.webp',
      '/manifest.webmanifest',
    ].includes(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit =
          (await cache.match(event.request)) ||
          (url.pathname.startsWith('/assets/') ? await caches.match(event.request) : undefined);
        if (hit) return hit;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
  }
});
