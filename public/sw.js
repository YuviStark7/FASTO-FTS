/* FASTO FTS service worker: makes the app installable and shows an offline page when the network
   is down. It caches nothing else on purpose: every figure must come fresh from the server with
   its grade and source (offline data caching is first on the release cut list). */
const OFFLINE = "/offline.html";
const CACHE = "fasto-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Only page navigations are handled: network first, the offline page if the network fails.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
