/**
 * Push notification handler for the service worker.
 *
 * This file is loaded by the workbox-generated service worker via
 * importScripts. It handles incoming push events and notification clicks.
 *
 * Push payload format (JSON):
 * {
 *   title: "Nuevo pedido",
 *   body: "Juan Perez - $25.00",
 *   icon: "/favicon.ico",
 *   badge: "/favicon.ico",
 *   tag: "order-abc123",
 *   url: "/orders",
 *   data: { type: "new_order", orderId: "abc123" }
 * }
 */

// eslint-disable-next-line no-undef
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // If not JSON, use the text as the body
    payload = {
      title: "Nova",
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "nova-notification",
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
    // Vibrate pattern: short-long-short (mobile)
    vibrate: [100, 200, 100],
    // Keep notification visible until user interacts
    requireInteraction: true,
  };

  event.waitUntil(
    // eslint-disable-next-line no-undef, no-restricted-globals
    self.registration.showNotification(payload.title || "Nova", options),
  );
});

/**
 * Handle notification click: open the app at the specified URL.
 * If the app is already open, focus that tab instead of opening a new one.
 */
// eslint-disable-next-line no-undef
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    // eslint-disable-next-line no-undef, no-restricted-globals
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Try to find an existing Nova tab and focus it
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // If no existing tab, find any Nova tab and navigate it
        for (const client of windowClients) {
          if ("focus" in client && "navigate" in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
        }
        // Last resort: open a new window
        // eslint-disable-next-line no-undef, no-restricted-globals
        return clients.openWindow(targetUrl);
      }),
  );
});
