const CACHE_NAME = 'svm-gold-v2'; // Increment version to clear old cache
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event - Pre-cache basic assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate Event - Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old versions of the cache
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all open pages immediately
      self.clients.claim()
    ])
  );
});

// Fetch Event - Stale-While-Revalidate strategy
// This serves from cache but fetches and updates the cache in the background
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          // If network request succeeds, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // If network fails, we already have the cachedResponse (if any)
        });

        // Return cached response immediately if it exists, otherwise wait for network
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
