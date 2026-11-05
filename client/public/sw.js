// Only handles clicks on notifications. It has no fetch handler, so it never sees or caches app traffic.

/** Brings an open tab to the message, or opens a new one. */
async function openThread(target) {
  const [tab] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!tab) return self.clients.openWindow(new URL(target.path.slice(1), self.registration.scope));
  tab.postMessage({ type: 'open-thread', target });
  return tab.focus();
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openThread(event.notification.data.target));
});
