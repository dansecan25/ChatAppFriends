<script setup lang="ts">
import { computed } from 'vue';
import { useChannelStore } from '@/stores/channelStore';
import { useVoiceStore } from '@/stores/voiceStore';
import AppIcon from './AppIcon.vue';

const voice = useVoiceStore();
const channels = useChannelStore();

const channelName = computed(() => channels.voiceChannels.find((channel) => channel.id === voice.channelId)?.name);
const statusLabel = computed(() => (voice.status === 'connected' ? 'Voice connected' : 'Connecting…'));
</script>

<template>
  <div v-if="voice.error" class="error" role="alert">
    <span>{{ voice.error }}</span>
    <button class="icon-btn" aria-label="Dismiss" @click="voice.clearError()">
      <AppIcon name="close" :size="16" />
    </button>
  </div>

  <section v-if="voice.status !== 'idle'" class="panel" aria-label="Voice controls">
    <div class="status">
      <strong :class="voice.status" role="status">{{ statusLabel }}</strong>
      <span class="channel">{{ channelName }}</span>
    </div>
    <button
      class="icon-btn"
      :class="{ off: voice.muted }"
      :aria-pressed="voice.muted"
      :title="voice.muted ? 'Unmute' : 'Mute'"
      :aria-label="voice.muted ? 'Unmute' : 'Mute'"
      @click="voice.toggleMute()"
    >
      <AppIcon :name="voice.muted ? 'micOff' : 'mic'" />
    </button>
    <button
      class="icon-btn"
      :class="{ off: voice.deafened }"
      :aria-pressed="voice.deafened"
      :title="voice.deafened ? 'Undeafen' : 'Deafen'"
      :aria-label="voice.deafened ? 'Undeafen' : 'Deafen'"
      @click="voice.toggleDeafen()"
    >
      <AppIcon :name="voice.deafened ? 'headphonesOff' : 'headphones'" />
    </button>
    <button class="icon-btn hangup" title="Leave voice" aria-label="Leave voice" @click="voice.leave()">
      <AppIcon name="hangup" />
    </button>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.55rem 0.5rem 0.55rem 0.75rem;
  border-top: 1px solid var(--border);
  background: var(--bg-deep);
}

.status {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  font-size: 0.82rem;
}

.connected {
  color: var(--speaking);
}

.connecting {
  color: var(--accent-strong);
}

.channel {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.off,
.hangup:hover:not(:disabled) {
  color: var(--danger);
}

.error {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.5rem 0.35rem 0.5rem 0.75rem;
  border-top: 1px solid var(--border);
  color: var(--danger);
  font-size: 0.85rem;
}

.error span {
  flex: 1;
}
</style>
