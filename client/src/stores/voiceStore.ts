import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { toVoiceParticipant } from '@/mappers/voiceMapper';
import { socketRequest } from '@/services/socketClient';
import { VoiceClient } from '@/services/voiceClient';
import type { VoiceRosterDto } from '@/types/dto';
import type { VoiceParticipant, VoiceStatus } from '@/types/models';
import { microphoneErrorMessage } from '@/utils/errors';

export const useVoiceStore = defineStore('voice', () => {
  const status = ref<VoiceStatus>('idle');
  const channelId = ref<number | null>(null);
  const muted = ref(false);
  const deafened = ref(false);
  const error = ref<string | null>(null);
  const rosters = ref<Record<number, VoiceParticipant[]>>({});
  const speakingUserIds = ref(new Set<number>());

  const participants = computed(() => (channelId.value === null ? [] : (rosters.value[channelId.value] ?? [])));

  let client: VoiceClient | null = null;

  /** Stops the local session without contacting the server. */
  function reset(): void {
    client?.close();
    client = null;
    status.value = 'idle';
    channelId.value = null;
    muted.value = false;
    deafened.value = false;
    speakingUserIds.value = new Set();
  }

  /** Joins a voice channel, leaving the current one first. */
  async function join(targetChannelId: number): Promise<void> {
    if (channelId.value === targetChannelId) return;
    reset();
    error.value = null;
    status.value = 'connecting';
    channelId.value = targetChannelId;

    const session = new VoiceClient((message) => {
      error.value = message;
      void leave();
    });
    client = session;
    try {
      await session.connect(targetChannelId);
      if (client === session) status.value = 'connected';
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (client === session && !aborted) {
        error.value = microphoneErrorMessage(err);
        await leave();
      }
    }
  }

  /** Leaves voice and tells the server. */
  async function leave(): Promise<void> {
    reset();
    await socketRequest('voice:leave').catch(() => undefined);
  }

  const syncState = () =>
    socketRequest('voice:setState', { muted: muted.value, deafened: deafened.value }).catch(() => undefined);

  /** Toggles the microphone; unmuting also ends deafen. */
  function toggleMute(): void {
    muted.value = !muted.value;
    client?.setMuted(muted.value);
    if (!muted.value && deafened.value) {
      deafened.value = false;
      client?.setDeafened(false);
    }
    void syncState();
  }

  /** Toggles hearing others; deafening also mutes the microphone. */
  function toggleDeafen(): void {
    deafened.value = !deafened.value;
    client?.setDeafened(deafened.value);
    muted.value = deafened.value;
    client?.setMuted(muted.value);
    void syncState();
  }

  /** Replaces all voice rosters. */
  function setRosters(list: VoiceRosterDto[]): void {
    rosters.value = Object.fromEntries(
      list.map((roster) => [roster.channelId, roster.participants.map(toVoiceParticipant)]),
    );
  }

  /** Updates one channel's roster. */
  function setRoster(roster: VoiceRosterDto): void {
    rosters.value[roster.channelId] = roster.participants.map(toVoiceParticipant);
  }

  /** Records who is speaking in the joined channel. */
  function setSpeaking(speakingChannelId: number, userIds: number[]): void {
    if (speakingChannelId === channelId.value) speakingUserIds.value = new Set(userIds);
  }

  /** Ends the session because of a server event or a lost connection. */
  function handleForcedLeave(reason: string): void {
    if (status.value === 'idle') return;
    reset();
    error.value = reason;
  }

  /** Dismisses the current error. */
  function clearError(): void {
    error.value = null;
  }

  return {
    status,
    channelId,
    muted,
    deafened,
    error,
    rosters,
    speakingUserIds,
    participants,
    join,
    leave,
    reset,
    toggleMute,
    toggleDeafen,
    setRosters,
    setRoster,
    setSpeaking,
    handleForcedLeave,
    clearError,
  };
});
