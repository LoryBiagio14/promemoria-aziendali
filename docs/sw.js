const CACHE = 'promemoria-v1';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', function(e) {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Promemoria Aziendali', {
      body: data.body || '',
      icon: '/promemoria-aziendali/icon.png',
      badge: '/promemoria-aziendali/icon.png',
      tag: data.tag || 'promemoria-' + Date.now(),
      requireInteraction: true,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('promemoria-aziendali') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/promemoria-aziendali/');
    })
  );
});
