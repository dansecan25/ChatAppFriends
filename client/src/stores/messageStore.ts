import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as messageApi from '@/api/messageApi';
import type { Message } from '@/types/models';

interface ChannelMessages {
  messages: Message[];
  hasMore: boolean;
  loaded: boolean;
}

const emptyChannel = (): ChannelMessages => ({ messages: [], hasMore: true, loaded: false });

export const useMessageStore = defineStore('messages', () => {
  const byChannel = ref<Record<number, ChannelMessages>>({});

  const channelState = (channelId: number): ChannelMessages => (byChannel.value[channelId] ??= emptyChannel());

  /** Loads the newest page of a channel, replacing what is cached. */
  async function loadLatest(channelId: number): Promise<void> {
    const page = await messageApi.fetchMessages(channelId);
    byChannel.value[channelId] = {
      messages: page,
      hasMore: page.length === messageApi.MESSAGE_PAGE_SIZE,
      loaded: true,
    };
  }

  /** Loads the page before the oldest cached message. */
  async function loadOlder(channelId: number): Promise<void> {
    const state = channelState(channelId);
    const oldest = state.messages[0];
    if (!oldest || !state.hasMore) return;
    const page = await messageApi.fetchMessages(channelId, oldest.id);
    state.messages.unshift(...page);
    state.hasMore = page.length === messageApi.MESSAGE_PAGE_SIZE;
  }

  /** Adds a message once, whether it arrives by HTTP reply or socket event. */
  function addMessage(message: Message): void {
    const state = channelState(message.channelId);
    if (!state.messages.some((existing) => existing.id === message.id)) state.messages.push(message);
  }

  /** Sends a text message. */
  async function send(channelId: number, content: string): Promise<void> {
    addMessage(await messageApi.sendMessage(channelId, content));
  }

  /** Drops the cache for a deleted channel. */
  function removeChannel(channelId: number): void {
    delete byChannel.value[channelId];
  }

  return { byChannel, channelState, loadLatest, loadOlder, addMessage, send, removeChannel };
});
