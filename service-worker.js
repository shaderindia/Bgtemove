/**
 * Service Worker for offline support and caching
 * - Precache app shell (relative paths for GH Pages)
 * - Stale-while-revalidate for the ONNX model
 * - Cache .wasm at runtime (optional)
 */
const CACHE = 'bgremove-v1-20251104-3';

// Mandatory app shell assets (must exist)
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
  'manifest.webmanifest',
  // Model (versioned)
  'public/u2netp.onnx?v=20251104'
];

// Optional assets (try to cache, but ignore failures if missing)
const OPTIONAL = [
  'public/icon-192.png',
  'public/icon-512.png',
  'public/ort-wasm.wasm',
  'public/ort-wasm-simd.wasm'
  // 'public/ort-wasm-threaded.wasm',
  // 'public/ort-wasm-simd-threaded.wasm'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Precache mandatory assets (fail install if these fail)
    await cache.addAll(ASSETS);
    // Try optional assets (don’t fail if any are missing)
    await Promise.allSettled(
      OPTIONAL.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: 'no-cache' });
          if (resp.ok) await cache.put(url, resp.clone());
        } catch {}
      })
    );
    await self.skipWaiting();
  })());
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
