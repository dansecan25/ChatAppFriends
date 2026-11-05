import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as channelApi from '@/api/channelApi';
import type { ChannelType } from '@/types/dto';
import type { Channel } from '@/types/models';

export const useChannelStore = defineStore('channels', () => {
  const channels = ref<Channel[]>([]);
  const loaded = ref(false);
  const unread = ref(new Set<number>());

  const textChannels = computed(() => channels.value.filter((channel) => channel.type === 'text'));
  const voiceChannels = computed(() => channels.value.filter((channel) => channel.type === 'voice'));

  /** Loads the channel list. */
  async function fetchChannels(): Promise<void> {
    channels.value = await channelApi.fetchChannels();
    loaded.value = true;
  }

  /** Adds a channel unless it is already known. */
  function addChannel(channel: Channel): void {
    if (!channels.value.some((existing) => existing.id === channel.id)) channels.value.push(channel);
  }

  /** Removes a channel from the list. */
  function removeChannel(id: number): void {
    channels.value = channels.value.filter((channel) => channel.id !== id);
    unread.value.delete(id);
  }

  /** Creates a channel on the server. */
  async function createChannel(name: string, type: ChannelType): Promise<Channel> {
    const channel = await channelApi.createChannel(name, type);
    addChannel(channel);
    return channel;
  }

  /** Deletes a channel on the server. */
  async function deleteChannel(id: number): Promise<void> {
    await channelApi.deleteChannel(id);
    removeChannel(id);
  }

  /** Flags a channel as having unseen messages. */
  function markUnread(id: number): void {
    unread.value.add(id);
  }

  /** Clears a channel's unread flag. */
  function markRead(id: number): void {
    unread.value.delete(id);
  }

  return {
    channels,
    loaded,
    unread,
    textChannels,
    voiceChannels,
    fetchChannels,
    addChannel,
    removeChannel,
    createChannel,
    deleteChannel,
    markUnread,
    markRead,
  };
});
