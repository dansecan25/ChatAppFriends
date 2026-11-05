/** Where a click on a notification should lead. */
export interface NotificationTarget {
  path: string;
  serverId: number | null;
}

export interface AppNotification {
  title: string;
  body: string;
  /** Tabs showing the same message use the same tag, so it only appears once. */
  tag: string;
  threadKey: string;
  target: NotificationTarget;
}

const WORKER_URL = `${import.meta.env.BASE_URL}sw.js`;

export const notificationsSupported = (): boolean => 'Notification' in window;

/** Chrome on Android only shows notifications through a service worker. */
async function register(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register(WORKER_URL);
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;
const getRegistration = () => (registration ??= register());

let onOpen: (target: NotificationTarget) => void = () => undefined;

/** Shows a notification, directly when the service worker isn't available. */
export async function showNotification({ title, body, tag, threadKey, target }: AppNotification): Promise<void> {
  const worker = await getRegistration();
  const options = { body, tag, data: { threadKey, target } };
  if (worker) return worker.showNotification(title, options);
  const shown = new Notification(title, options);
  shown.onclick = () => {
    window.focus();
    shown.close();
    onOpen(target);
  };
}

/** Clears shown notifications: one thread's when given a key, otherwise all of them. */
export async function closeNotifications(threadKey?: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const shown = (await (await getRegistration())?.getNotifications()) ?? [];
  shown.filter((item) => !threadKey || item.data?.threadKey === threadKey).forEach((item) => item.close());
}

/** Clears the notification for a message that was deleted. */
export async function closeMessageNotification(messageId: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const shown = (await (await getRegistration())?.getNotifications({ tag: messageId })) ?? [];
  shown.forEach((item) => item.close());
}

/** Calls back when a notification is clicked. Returns a function that stops listening. */
export function listenForOpens(callback: (target: NotificationTarget) => void): () => void {
  onOpen = callback;
  if (!('serviceWorker' in navigator)) return () => undefined;
  const onMessage = ({ data }: MessageEvent) => {
    if (data?.type === 'open-thread') callback(data.target);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  navigator.serviceWorker.startMessages();
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
