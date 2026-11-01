// Attendance app service worker: phone notifications (web push) and the
// offline page. Pages always come from the network (always the latest
// version); only when there's no connection does a page tap show the saved
// offline page (public/offline.html) with the business's logo and name.
const CACHE = "offline-v1";
const SAVED = ["/offline.html", "/brand-logo", "/api/public/brand"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SAVED)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  // Logo / name: fresh when online (and the saved copy updated), saved copy when not.
  if (url.pathname === "/brand-logo" || url.pathname === "/api/public/brand") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((r) => r || Response.error())),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "The Royal Chilli", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "The Royal Chilli";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

// Tap → open (or focus) the app on the right screen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
