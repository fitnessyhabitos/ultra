const CACHE_NAME = 'fitdatapro-shell-v3';
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

// --- PUSH NOTIFICATIONS ---
self.addEventListener('push', function (event) {
  let data = { title: "Nueva Notificación", body: "Tienes un nuevo mensaje de Fit Data Ultra", icon: "./img/logo.png" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './img/logo.png',
    badge: './img/logo.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    data: data.url || '/', // URL a abrir si se hace clic
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // Open the app or focus the tab
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(event.notification.data) && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow)
        return clients.openWindow(event.notification.data);
    })
  );
});