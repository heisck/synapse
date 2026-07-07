// Service-worker kill switch. No service worker is part of this app, but a
// previous build registered one on this origin; browsers keep requesting
// /sw.js forever until a file at this URL unregisters it.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => client.navigate(client.url));
});
