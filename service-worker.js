const CACHE_PREFIX = "evolucao-clinica-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v17`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manager.css",
  "./app.js",
  "./manager.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Network-first atualiza HTML/JS/CSS; o cache é usado como fallback offline.
      const response = await fetch(request);
      if (response && response.ok) {
        try { await cache.put(request, response.clone()); } catch (_) { /* resposta continua válida */ }
      }
      return response;
    } catch (_) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const fallbackURL = new URL("./index.html", self.registration.scope);
        return (await cache.match(fallbackURL.href)) || Response.error();
      }
      return Response.error();
    }
  })());
});
