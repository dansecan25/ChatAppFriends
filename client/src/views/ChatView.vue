<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/AppIcon.vue';
import ChannelSidebar from '@/components/ChannelSidebar.vue';
import MessageComposer from '@/components/MessageComposer.vue';
import MessageList from '@/components/MessageList.vue';
import { useRealtime } from '@/composables/useRealtime';
import { useChannelStore } from '@/stores/channelStore';
import { useMessageStore } from '@/stores/messageStore';
import { errorMessage } from '@/utils/errors';

const route = useRoute();
const router = useRouter();
const channels = useChannelStore();
const messages = useMessageStore();

const sidebarOpen = ref(false);
const loadError = ref<string | null>(null);

const activeChannelId = computed(() => (route.params.channelId ? Number(route.params.channelId) : null));
const activeChannel = computed(
  () => channels.textChannels.find((channel) => channel.id === activeChannelId.value) ?? null,
);

const { connected } = useRealtime(activeChannelId);

/** Opens the first text channel when the current route has no valid channel. */
function redirectToValidChannel(): void {
  if (!channels.loaded || activeChannel.value) return;
  const first = channels.textChannels[0];
  void router.replace(first ? { name: 'chat', params: { channelId: first.id } } : { name: 'chat' });
}

/** Marks the visible channel as read when the tab regains focus. */
function onVisibilityChange(): void {
  if (!document.hidden && activeChannelId.value !== null) channels.markRead(activeChannelId.value);
}

watch(
  activeChannel,
  async (channel) => {
    redirectToValidChannel();
    sidebarOpen.value = false;
    if (!channel) return;
    channels.markRead(channel.id);
    loadError.value = null;
    try {
      await messages.loadLatest(channel.id);
    } catch (err) {
      loadError.value = errorMessage(err, 'Could not load messages');
    }
  },
  { flush: 'post' },
);

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  try {
    await channels.fetchChannels();
    redirectToValidChannel();
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load channels');
  }
});

onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange));
</script>

<template>
  <div class="layout">
    <div v-if="sidebarOpen" class="scrim" @click="sidebarOpen = false" />
    <ChannelSidebar class="sidebar" :class="{ open: sidebarOpen }" @navigate="sidebarOpen = false" />

    <main class="main">
      <header class="topbar">
        <button class="icon-btn menu" aria-label="Open channels" @click="sidebarOpen = true">
          <AppIcon name="menu" />
        </button>
        <template v-if="activeChannel">
          <AppIcon name="hash" :size="18" class="hash" />
          <h1>{{ activeChannel.name }}</h1>
        </template>
        <span v-if="!connected" class="offline" role="status">Reconnecting…</span>
      </header>

      <p v-if="loadError" class="form-error banner" role="alert">{{ loadError }}</p>

      <template v-if="activeChannel">
        <MessageList :key="activeChannel.id" :channel-id="activeChannel.id" />
        <MessageComposer :channel-id="activeChannel.id" :channel-name="activeChannel.name" />
      </template>
      <div v-else-if="channels.loaded" class="empty">
        <h2>No text channels yet</h2>
        <p>Create one from the sidebar to start chatting.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100dvh;
}

.sidebar {
  width: 270px;
  flex-shrink: 0;
}

.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  background: var(--bg-main);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
}

.topbar h1 {
  margin: 0;
  overflow: hidden;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hash {
  flex-shrink: 0;
  color: var(--text-faint);
}

.menu {
  display: none;
}

.offline {
  margin-left: auto;
  padding: 0.15rem 0.6rem;
  border-radius: 99px;
  background: var(--bg-raised);
  color: var(--accent-strong);
  font-size: 0.8rem;
  white-space: nowrap;
}

.banner {
  padding: 0.5rem 16px;
}

.empty {
  margin: auto;
  padding: 16px;
  color: var(--text-muted);
  text-align: center;
}

.empty h2 {
  margin: 0 0 0.25rem;
  color: var(--text);
}

.scrim {
  display: none;
}

@media (max-width: 760px) {
  .menu {
    display: inline-flex;
    margin-left: -8px;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 20;
    width: min(290px, 85vw);
    transform: translateX(-100%);
    transition: transform 0.18s ease;
  }

  .sidebar.open {
    transform: none;
  }

  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 10;
    background: rgb(0 0 0 / 55%);
  }
}
</style>
