self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const fallback = {
    title: "Go Atleta",
    body: "Você recebeu uma nova notificação.",
    data: { route: "/notifications" },
  };
  let payload = fallback;
  try {
    payload = { ...fallback, ...(event.data ? event.data.json() : {}) };
  } catch {
    // Keep the safe fallback when a provider sends malformed data.
  }
  event.waitUntil(self.registration.showNotification(String(payload.title || fallback.title), {
    body: String(payload.body || fallback.body),
    data: payload.data && typeof payload.data === "object" ? payload.data : fallback.data,
    badge: "/favicon.ico",
    icon: "/favicon.ico",
    tag: payload.data?.notificationId ? `goatleta-${payload.data.notificationId}` : undefined,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let route = typeof event.notification.data?.route === "string"
    ? event.notification.data.route
    : "/notifications";
  const params = event.notification.data?.params;
  if (params && typeof params === "object") {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, rawValue]) => {
      if (rawValue === null || rawValue === undefined) return;
      const value = String(rawValue);
      const placeholder = `[${key}]`;
      if (route.includes(placeholder)) route = route.replace(placeholder, encodeURIComponent(value));
      else query.set(key, value);
    });
    const suffix = query.toString();
    if (suffix) route += `${route.includes("?") ? "&" : "?"}${suffix}`;
  }
  const target = new URL(route.startsWith("/") ? route : "/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      return existing.navigate(target);
    }
    return self.clients.openWindow(target);
  })());
});
