import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as channelApi from '@/api/channelApi';
import { wrapForMember } from '@/services/crypto/keyring';
import { newSymmetricKey } from '@/services/crypto/primitives';
import type { ChannelType, MemberDto } from '@/types/dto';
import type { Channel } from '@/types/models';

/** Tells whether a member may use a restricted channel. */
export const memberHasAccess = (channel: Pick<Channel, 'roleIds' | 'createdBy'>, member: MemberDto): boolean =>
  member.id === channel.createdBy || member.roleIds.some((roleId) => channel.roleIds.includes(roleId));

export const useChannelStore = defineStore('channels', () => {
  const channels = ref<Channel[]>([]);
  const loaded = ref(false);
  /** Thread keys with unseen messages, covering channels and DMs. */
  const unread = ref(new Set<string>());

  const textChannels = computed(() => channels.value.filter((channel) => channel.type === 'text'));
  const voiceChannels = computed(() => channels.value.filter((channel) => channel.type === 'voice'));

  /** Loads a server's channels. */
  async function fetchChannels(serverId: number): Promise<void> {
    channels.value = await channelApi.fetchChannels(serverId);
    loaded.value = true;
  }

  /** Adds a channel unless it is already known. */
  function addChannel(channel: Channel): void {
    if (!channels.value.some((existing) => existing.id === channel.id)) channels.value.push(channel);
  }

  /** Removes a channel from the list. */
  function removeChannel(id: number): void {
    channels.value = channels.value.filter((channel) => channel.id !== id);
    unread.value.delete(`c${id}`);
  }

  /** Creates a channel. A restricted text channel gets a key only its allowed members can open. */
  async function createChannel(
    serverId: number,
    name: string,
    type: ChannelType,
    roleIds: number[],
    members: MemberDto[],
    userId: number,
  ): Promise<Channel> {
    const encrypted = roleIds.length > 0 && type === 'text';
    const raw = newSymmetricKey();
    const audience = encrypted ? members.filter((member) => memberHasAccess({ roleIds, createdBy: userId }, member)) : [];
    const envelopes = await Promise.all(
      audience.map(async (member) => ({ version: 0, userId: member.id, wrappedKey: await wrapForMember(raw, member) })),
    );
    const channel = await channelApi.createChannel(serverId, { name, type, roleIds, envelopes });
    addChannel(channel);
    return channel;
  }

  /** Deletes a channel on the server. */
  async function deleteChannel(id: number): Promise<void> {
    await channelApi.deleteChannel(id);
    removeChannel(id);
  }

  /** Flags a thread as having unseen messages. */
  function markUnread(threadKey: string): void {
    unread.value.add(threadKey);
  }

  /** Clears a thread's unread flag. */
  function markRead(threadKey: string): void {
    unread.value.delete(threadKey);
  }

  /** Clears everything on sign-out. */
  function reset(): void {
    channels.value = [];
    loaded.value = false;
    unread.value = new Set();
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
    reset,
  };
});
