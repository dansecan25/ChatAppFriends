import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { toChannel } from '@/mappers/channelMapper';
import { forgetChannelKeys, refreshRootKeys, threadKeyOf, type Thread } from '@/services/crypto/keyring';
import { runKeyWork } from '@/services/keySharing';
import { socket } from '@/services/socketClient';
import { useChannelStore } from '@/stores/channelStore';
import { useDmStore } from '@/stores/dmStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import type { ChannelDto, MessageDto } from '@/types/dto';

/** Connects the socket for the chat screen and feeds server events into the stores. */
export function useRealtime(activeThread: Ref<Thread | null>): { connected: Ref<boolean> } {
  const router = useRouter();
  const servers = useServerStore();
  const channels = useChannelStore();
  const dms = useDmStore();
  const messages = useMessageStore();
  const voice = useVoiceStore();
  const connected = ref(socket.connected);
  let hasConnectedBefore = false;

  const doKeyWork = (serverId: number) => {
    void runKeyWork(serverId).catch((err) => console.error('Could not share keys:', err));
  };

  const refreshChannels = async () => {
    if (servers.activeId === null) return;
    channels.channels.forEach((channel) => forgetChannelKeys(channel.id));
    await channels.fetchChannels(servers.activeId);
  };

  const onConnect = () => {
    connected.value = true;
    servers.servers.forEach((server) => doKeyWork(server.id));
    if (hasConnectedBefore) {
      void refreshChannels();
      void dms.fetchDms();
      if (activeThread.value) void messages.loadLatest(activeThread.value);
    }
    hasConnectedBefore = true;
  };
  const onDisconnect = () => {
    connected.value = false;
    voice.handleForcedLeave('Connection lost. Rejoin the voice channel when you are back online.');
  };

  /** Works out which thread a new message belongs to. Other servers' channels only get an unread mark. */
  const threadOf = (dto: MessageDto): Thread | null => {
    if (dto.dmId !== null) return { kind: 'dm', id: dto.dmId };
    const channel = channels.channels.find((candidate) => candidate.id === dto.channelId);
    return channel ? { kind: 'channel', id: channel.id, serverId: channel.serverId, restricted: channel.restricted } : null;
  };
  const onMessage = async (dto: MessageDto) => {
    const thread = threadOf(dto);
    if (!thread) return;
    await messages.receive(dto, thread);
    const key = threadKeyOf(thread);
    if (!activeThread.value || key !== threadKeyOf(activeThread.value) || document.hidden) channels.markUnread(key);
  };
  const onChannelCreated = (dto: ChannelDto) => {
    if (dto.serverId === servers.activeId) channels.addChannel(toChannel(dto));
  };
  const onChannelDeleted = ({ id }: { id: number }) => {
    channels.removeChannel(id);
    messages.removeThread(`c${id}`);
  };
  const onKicked = ({ reason }: { reason: string }) => voice.handleForcedLeave(reason);
  const onSpeaking = ({ channelId, userIds }: { channelId: number; userIds: number[] }) =>
    voice.setSpeaking(channelId, userIds);
  const onRenamed = ({ id, name }: { id: number; name: string }) => servers.applyRename(id, name);
  const onAccessChanged = () => void refreshChannels();
  const onRolesChanged = () => void servers.fetchMembership();
  const onKeysNeeded = ({ serverId }: { serverId: number }) => doKeyWork(serverId);
  const onDmCreated = () => void dms.fetchDms();
  const onServerKeyChanged = ({ serverId }: { serverId: number }) => void refreshRootKeys(serverId);
  /** Leaves a server this user was removed from. With no server left, they're asked for a new code. */
  const onMemberRemoved = async () => {
    voice.handleForcedLeave('You were removed from this server');
    await servers.fetchServers();
    if (servers.servers.length === 0) await router.replace({ name: 'join' });
  };

  const handlers: [string, (...args: any[]) => void][] = [
    ['connect', onConnect],
    ['disconnect', onDisconnect],
    ['message:new', onMessage],
    ['channel:created', onChannelCreated],
    ['channel:deleted', onChannelDeleted],
    ['server:renamed', onRenamed],
    ['access:changed', onAccessChanged],
    ['roles:changed', onRolesChanged],
    ['keys:needed', onKeysNeeded],
    ['dm:created', onDmCreated],
    ['server:keyChanged', onServerKeyChanged],
    ['member:removed', onMemberRemoved],
    ['voice:rosters', voice.setRosters],
    ['voice:roster', voice.setRoster],
    ['voice:speaking', onSpeaking],
    ['voice:kicked', onKicked],
  ];

  onMounted(() => {
    handlers.forEach(([event, handler]) => socket.on(event, handler));
    socket.connect();
  });

  onBeforeUnmount(() => {
    handlers.forEach(([event, handler]) => socket.off(event, handler));
    socket.disconnect();
    voice.reset();
  });

  return { connected };
}
