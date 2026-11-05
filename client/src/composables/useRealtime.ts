import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { toChannel } from '@/mappers/channelMapper';
import { toMessage } from '@/mappers/messageMapper';
import { socket } from '@/services/socketClient';
import { useChannelStore } from '@/stores/channelStore';
import { useMessageStore } from '@/stores/messageStore';
import { useVoiceStore } from '@/stores/voiceStore';
import type { ChannelDto, MessageDto } from '@/types/dto';

/** Connects the socket for the chat screen and feeds server events into the stores. */
export function useRealtime(activeChannelId: Ref<number | null>): { connected: Ref<boolean> } {
  const channels = useChannelStore();
  const messages = useMessageStore();
  const voice = useVoiceStore();
  const connected = ref(socket.connected);
  let hasConnectedBefore = false;

  const onConnect = () => {
    connected.value = true;
    if (hasConnectedBefore) {
      void channels.fetchChannels();
      if (activeChannelId.value !== null) void messages.loadLatest(activeChannelId.value);
    }
    hasConnectedBefore = true;
  };
  const onDisconnect = () => {
    connected.value = false;
    voice.handleForcedLeave('Connection lost. Rejoin the voice channel when you are back online.');
  };
  const onMessage = (dto: MessageDto) => {
    messages.addMessage(toMessage(dto));
    if (dto.channelId !== activeChannelId.value || document.hidden) channels.markUnread(dto.channelId);
  };
  const onChannelCreated = (dto: ChannelDto) => channels.addChannel(toChannel(dto));
  const onChannelDeleted = ({ id }: { id: number }) => {
    channels.removeChannel(id);
    messages.removeChannel(id);
  };
  const onKicked = ({ reason }: { reason: string }) => voice.handleForcedLeave(reason);
  const onSpeaking = ({ channelId, userIds }: { channelId: number; userIds: number[] }) =>
    voice.setSpeaking(channelId, userIds);

  const handlers: [string, (...args: any[]) => void][] = [
    ['connect', onConnect],
    ['disconnect', onDisconnect],
    ['message:new', onMessage],
    ['channel:created', onChannelCreated],
    ['channel:deleted', onChannelDeleted],
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
