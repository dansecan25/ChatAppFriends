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

/** Lists those who can use a channel: everyone, unless it's restricted. */
export const membersOf = (channel: Channel, members: MemberDto[]): MemberDto[] =>
  channel.restricted ? members.filter((member) => memberHasAccess(channel, member)) : members;

export const useChannelStore = defineStore('channels', () => {
  const channels = ref<Channel[]>([]);
  const loaded = ref(false);
  /** Thread keys with unseen messages, covering channels and DMs. */
  const unread = ref(new Set<string>());
  /** Channels of every server, since messages also arrive from servers not on screen. */
  const directory = ref(new Map<number, Channel>());

  const textChannels = computed(() => channels.value.filter((channel) => channel.type === 'text'));
  const voiceChannels = computed(() => channels.value.filter((channel) => channel.type === 'voice'));

  /** Loads a server's channels. */
  async function fetchChannels(serverId: number): Promise<void> {
    channels.value = await channelApi.fetchChannels(serverId);
    loaded.value = true;
  }

  /** Finds a channel this user can see, among those already loaded. */
  const findKnown = (id: number): Channel | undefined =>
    channels.value.find((channel) => channel.id === id) ?? directory.value.get(id);

  /** Finds a channel in any of the given servers, loading them if it isn't known yet. */
  async function locate(id: number, serverIds: number[]): Promise<Channel | undefined> {
    if (!findKnown(id)) {
      const lists = await Promise.all(serverIds.map((serverId) => channelApi.fetchChannels(serverId)));
      directory.value = new Map(lists.flat().map((channel) => [channel.id, channel]));
    }
    return findKnown(id);
  }

  /** Remembers a channel created in a server that isn't on screen. */
  function remember(channel: Channel): void {
    directory.value.set(channel.id, channel);
  }

  /** Adds a channel unless it is already known. */
  function addChannel(channel: Channel): void {
    if (!channels.value.some((existing) => existing.id === channel.id)) channels.value.push(channel);
  }

  /** Removes a channel from the list. */
  function removeChannel(id: number): void {
    channels.value = channels.value.filter((channel) => channel.id !== id);
    directory.value.delete(id);
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
    directory.value = new Map();
  }

  return {
    channels,
    loaded,
    unread,
    textChannels,
    voiceChannels,
    fetchChannels,
    findKnown,
    locate,
    remember,
    addChannel,
    removeChannel,
    createChannel,
    deleteChannel,
    markUnread,
    markRead,
    reset,
  };
});
