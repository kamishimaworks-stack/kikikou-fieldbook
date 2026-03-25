const CACHE_NAME = "kikikou-fieldbook-v2";
const ASSETS = [
  "./index.html",
  "./style.css",
  "./calc.js",
  "./storage.js",
  "./keypad.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.svg",
  "./icon-512.svg"
];

// install: precache all assets, skipWaiting
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// activate: delete old caches, claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// fetch: network-first strategy (try network, fall back to cache for offline)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update cache with fresh response
        var clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
