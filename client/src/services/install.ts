import { ref } from 'vue';

/** Chrome's install offer, which can be shown later from a button. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const offer = ref<InstallPromptEvent | null>(null);
const installed = ref(
  window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
);

// Listened for at startup, since the browser may offer installing before any screen asks.
window.addEventListener('beforeinstallprompt', (event) => {
  offer.value = event as InstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
  offer.value = null;
  installed.value = true;
});

/** Whether this is an iPhone or iPad, where installing is only possible by hand from Safari's Share menu. */
export const isIos = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

/** Shows the browser's install dialog. */
export async function installApp(): Promise<void> {
  const event = offer.value;
  if (!event) return;
  offer.value = null;
  await event.prompt();
  if ((await event.userChoice).outcome === 'dismissed') offer.value = event;
}

export const installState = { offer, installed };
