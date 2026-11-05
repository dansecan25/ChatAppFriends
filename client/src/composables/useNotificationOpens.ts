import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { listenForOpens } from '@/services/notifications';
import { useChannelStore } from '@/stores/channelStore';
import { useServerStore } from '@/stores/serverStore';

/** Goes to the message when a notification is clicked, switching server first if needed. */
export function useNotificationOpens(): void {
  const router = useRouter();
  const servers = useServerStore();
  const channels = useChannelStore();
  let stop = () => {};

  onMounted(() => {
    stop = listenForOpens(async ({ path, serverId }) => {
      try {
        const switching = serverId !== null && serverId !== servers.activeId;
        if (switching) await channels.fetchChannels(serverId);
        await router.push(path);
        if (switching) servers.select(serverId);
      } catch (err) {
        console.error('Could not open that message:', err);
      }
    });
  });
  onBeforeUnmount(() => stop());
}
