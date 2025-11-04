/**
 * Service Worker for offline support and caching
 * - Precache app shell (relative paths for GH Pages)
 * - Stale-while-revalidate for the ONNX model
 * - Cache .wasm at runtime (optional)
 */
const CACHE = 'bgremove-v1-20251104';
const ASSETS = [
  'index.html',
  'public/styles.css',
  'public/ort.min.js',
  'src/app.js',
  'src/model.js',
  'src/image.js',
  'src/ui.js',
  'src/pwa.js',
  'public/logo.svg',
  'public/icon-192.png',
  'public/icon-512.png',
  'manifest.webmanifest',
  'public/u2netp.onnx?v=20251104'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Stale-while-revalidate for ONNX model
  if (url.pathname.endsWith('.onnx')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(resp => {
          const fetchPromise = fetch(e.request).then(networkResp => {
            cache.put(e.request, networkResp.clone());
            return networkResp;
          }).catch(() => resp);
          return resp || fetchPromise;
        })
      )
    );
    return;
  }

  // Runtime cache for ORT wasm binaries (if present)
  if (url.pathname.endsWith('.wasm')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(resp => resp || fetch(e.request).then(net => {
          cache.put(e.request, net.clone());
          return net;
        }))
      )
    );
    return;
  }

  // Cache-first for app shell
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
