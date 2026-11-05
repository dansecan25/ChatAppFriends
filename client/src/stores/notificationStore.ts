import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Thread } from '@/services/crypto/keyring';
import { notificationsSupported, showNotification } from '@/services/notifications';
import { useChannelStore } from '@/stores/channelStore';
import { useServerStore } from '@/stores/serverStore';
import type { Message } from '@/types/models';
import { mentionedChannelIds, mentionsToText, mentionsUser } from '@/utils/mentions';

interface Preferences {
  enabled: boolean;
  promptDismissed: boolean;
  mutedChannels: number[];
}

type Permission = NotificationPermission | 'unsupported';

const MAX_BODY_LENGTH = 140;
const defaults = (): Preferences => ({ enabled: true, promptDismissed: false, mutedChannels: [] });
const storageKey = (userId: number) => `chatapp-notifications:${userId}`;
const currentPermission = (): Permission => (notificationsSupported() ? Notification.permission : 'unsupported');

export const useNotificationStore = defineStore('notifications', () => {
  const channels = useChannelStore();
  const servers = useServerStore();

  const preferences = ref(defaults());
  const permission = ref(currentPermission());
  let userId: number | null = null;

  const active = computed(() => permission.value === 'granted' && preferences.value.enabled);
  const showPrompt = computed(() => permission.value === 'default' && !preferences.value.promptDismissed);

  /** Loads this person's choices, which are kept per browser. */
  function load(id: number): void {
    userId = id;
    permission.value = currentPermission();
    try {
      preferences.value = { ...defaults(), ...JSON.parse(localStorage.getItem(storageKey(id)) ?? '{}') };
    } catch {
      preferences.value = defaults();
    }
  }

  /** Applies a change and remembers it. */
  function update(change: Partial<Preferences>): void {
    preferences.value = { ...preferences.value, ...change };
    try {
      localStorage.setItem(storageKey(userId as number), JSON.stringify(preferences.value));
    } catch {
      // The choice just won't be remembered.
    }
  }

  /** Asks the browser for permission and turns notifications on. Must follow a click. */
  async function enable(): Promise<void> {
    permission.value = await Notification.requestPermission();
    update({ enabled: true });
  }

  const disable = () => update({ enabled: false });
  const dismissPrompt = () => update({ promptDismissed: true });
  const isMuted = (channelId: number) => preferences.value.mutedChannels.includes(channelId);

  /** Turns a channel's notifications off or back on. */
  function toggleMute(channelId: number): void {
    const others = preferences.value.mutedChannels.filter((id) => id !== channelId);
    update({ mutedChannels: isMuted(channelId) ? others : [...others, channelId] });
  }

  /** DMs and mentions of you always count. `#channel` counts if you can see that channel and haven't muted it. */
  function reasonToNotify(message: Message, thread: Thread): 'dm' | 'mention' | 'message' | null {
    if (thread.kind === 'dm') return 'dm';
    if (mentionsUser(message.content, userId as number)) return 'mention';
    const mentionsOpenChannel = mentionedChannelIds(message.content).some((id) => channels.findKnown(id) && !isMuted(id));
    return mentionsOpenChannel || !isMuted(thread.id) ? 'message' : null;
  }

  /** Shows mentions by name, as they'd read in the chat. */
  function readableText(message: Message): string {
    const text = mentionsToText(
      message.content,
      (part) => `@${servers.memberFor(part.id)?.nickname ?? part.name}`,
      (id) => `#${channels.findKnown(id)?.name ?? 'private-channel'}`,
    );
    if (text) return text.slice(0, MAX_BODY_LENGTH);
    return message.image ? 'Sent an image' : 'New message';
  }

  /** Notifies about a message from someone else, unless this person is already looking at it. */
  function notifyOf(message: Message, thread: Thread, beingRead: boolean): void {
    permission.value = currentPermission();
    if (!active.value || beingRead || message.author.id === userId) return;
    const reason = reasonToNotify(message, thread);
    if (!reason) return;

    const channel = thread.kind === 'channel' ? channels.findKnown(thread.id) : null;
    const otherServer = channel && channel.serverId !== servers.activeId;
    const author = otherServer ? message.author.username : (servers.memberFor(message.author.id)?.nickname ?? message.author.username);
    const place = channel ? `#${channel.name}` : '';
    const serverName = otherServer ? servers.servers.find((server) => server.id === channel.serverId)?.name : null;
    const where = serverName ? `${place} (${serverName})` : place;

    void showNotification({
      title: reason === 'dm' ? author : reason === 'mention' ? `${author} mentioned you in ${where}` : `${author} in ${where}`,
      body: message.protection === 'locked' ? 'New message' : readableText(message),
      tag: message.id,
      threadKey: message.threadKey,
      target: {
        path: thread.kind === 'dm' ? `/dms/${thread.id}` : `/channels/${thread.id}`,
        serverId: thread.kind === 'channel' ? thread.serverId : null,
      },
    }).catch((err) => console.error('Could not show a notification:', err));
  }

  return { permission, active, showPrompt, load, enable, disable, dismissPrompt, isMuted, toggleMute, notifyOf };
});
