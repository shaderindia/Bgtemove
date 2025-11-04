const CACHE_NAME = 'bgremove-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/public/styles.css',
    '/src/app.js',
    '/src/model.js',
    '/src/image.js',
    '/src/ui.js',
    '/src/pwa.js',
    '/manifest.webmanifest'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('.onnx')) {
        e.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(e.request).then(response => {
                    const fetchPromise = fetch(e.request).then(networkResponse => {
                        cache.put(e.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return response || fetchPromise;
                })
            )
        );
    } else {
        e.respondWith(
            caches.match(e.request).then(response => response || fetch(e.request))
        );
    }
});
