const CACHE_NAME = 'fitdatapro-shell-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/firebase.js',
  './js/auth.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      );
    })
  );
});

// Estrategia Network-First para asegurar que siempre haya la última versión del JS/CSS si hay red
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a Firebase y extensiones del navegador
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});