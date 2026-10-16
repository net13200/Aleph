/* Offline support: everything the app needs is cached on install. */
const CACHE = "aleph-v3";
const SHELL = [
  "./",
  "index.html",
  "css/app.css",
  "js/data.js",
  "js/audio.js",
  "js/store.js",
  "js/trace.js",
  "js/app.js",
  "js/splash.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "fonts/noto-sans-hebrew-hebrew.woff2",
  "fonts/noto-sans-hebrew-latin.woff2",
  "fonts/baloo2-sugigames.woff2",
  "audio/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        await cache.addAll(SHELL);
        // Pre-recorded audio listed in the manifest is cached too.
        try {
          const res = await fetch("audio/manifest.json", { cache: "no-cache" });
          const files = Object.values(await res.json());
          await cache.addAll([...new Set(files)].map((f) => "audio/" + f));
        } catch (_) {}
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok && new URL(e.request.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
