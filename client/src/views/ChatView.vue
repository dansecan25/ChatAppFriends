<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/AppIcon.vue';
import ChannelSidebar from '@/components/ChannelSidebar.vue';
import MessageComposer from '@/components/MessageComposer.vue';
import MemberList from '@/components/MemberList.vue';
import MessageList from '@/components/MessageList.vue';
import { useRealtime } from '@/composables/useRealtime';
import { requireIdentity } from '@/services/crypto/identity';
import { threadKeyOf, type Thread } from '@/services/crypto/keyring';
import { safetyNumber } from '@/services/crypto/primitives';
import { useChannelStore } from '@/stores/channelStore';
import { useDmStore } from '@/stores/dmStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { errorMessage } from '@/utils/errors';

const route = useRoute();
const router = useRouter();
const servers = useServerStore();
const channels = useChannelStore();
const dms = useDmStore();
const messages = useMessageStore();

const sidebarOpen = ref(false);
const membersOpen = ref(false);
const loadError = ref<string | null>(null);
const safety = ref<string | null>(null);

const activeDm = computed(() =>
  route.name === 'dm' ? (dms.dms.find((dm) => dm.id === Number(route.params.dmId)) ?? null) : null,
);
const activeChannel = computed(() =>
  route.params.channelId
    ? (channels.textChannels.find((channel) => channel.id === Number(route.params.channelId)) ?? null)
    : null,
);
const activeThread = computed<Thread | null>(() => {
  if (activeDm.value) return { kind: 'dm', id: activeDm.value.id };
  const channel = activeChannel.value;
  return channel ? { kind: 'channel', id: channel.id, serverId: channel.serverId, restricted: channel.restricted } : null;
});
const threadKey = computed(() => (activeThread.value ? threadKeyOf(activeThread.value) : null));
const title = computed(() => activeDm.value?.otherUser.username ?? activeChannel.value?.name ?? '');
const placeholder = computed(() =>
  activeDm.value ? `Message ${title.value}` : `Message #${title.value}`,
);

const { connected } = useRealtime(activeThread);

/** Opens the first text channel when the current route has no valid thread. */
function redirectToValidThread(): void {
  if (route.name === 'dm' || !channels.loaded || activeChannel.value) return;
  const first = channels.textChannels[0];
  void router.replace(first ? { name: 'chat', params: { channelId: first.id } } : { name: 'chat' });
}

/** Marks the visible thread as read when the tab regains focus. */
function onVisibilityChange(): void {
  if (!document.hidden && threadKey.value) channels.markRead(threadKey.value);
}

/** Loads the active server's channels and people. */
async function loadServer(): Promise<void> {
  if (servers.activeId === null) return;
  loadError.value = null;
  try {
    await Promise.all([channels.fetchChannels(servers.activeId), servers.fetchMembership()]);
    redirectToValidThread();
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load this server');
  }
}

watch(threadKey, async () => {
  redirectToValidThread();
  sidebarOpen.value = false;
  const thread = activeThread.value;
  if (!thread || !threadKey.value) return;
  channels.markRead(threadKey.value);
  loadError.value = null;
  try {
    await messages.loadLatest(thread);
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load messages');
  }
}, { flush: 'post' });

watch(() => servers.activeId, async () => {
  if (route.name !== 'dm') await router.replace({ name: 'chat' });
  await loadServer();
});

watch(activeDm, async (dm) => {
  safety.value = dm?.otherUser.publicKey ? await safetyNumber(requireIdentity().publicKey, dm.otherUser.publicKey) : null;
}, { immediate: true });

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  try {
    await dms.fetchDms();
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load your conversations');
  }
  await loadServer();
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
        <template v-if="activeThread">
          <AppIcon :name="activeDm ? 'dm' : activeChannel?.restricted ? 'lock' : 'hash'" :size="18" class="hash" />
          <h1>{{ title }}</h1>
          <span
            v-if="safety"
            class="safety"
            title="Compare this number with theirs, in person or on a call. If it matches, nobody swapped your keys."
          >
            Safety number {{ safety }}
          </span>
        </template>
        <span v-if="!connected" class="offline" role="status">Reconnecting…</span>
        <button v-if="activeChannel" class="icon-btn members-toggle" aria-label="Show members" @click="membersOpen = !membersOpen">
          <AppIcon name="users" />
        </button>
      </header>

      <p v-if="loadError" class="form-error banner" role="alert">{{ loadError }}</p>

      <template v-if="activeThread">
        <MessageList :key="threadKey ?? ''" :thread="activeThread" />
        <MessageComposer :thread="activeThread" :placeholder="placeholder" />
      </template>
      <div v-else-if="servers.loaded && servers.servers.length === 0" class="empty">
        <h2>No servers yet</h2>
        <p>Add a server to <code>serverDefinitions.ts</code> and a code to <code>INVITE_CODE</code>, then restart the backend.</p>
      </div>
      <div v-else-if="channels.loaded" class="empty">
        <h2>No text channels yet</h2>
        <p>Create one from the sidebar to start chatting.</p>
      </div>
    </main>

    <MemberList v-if="activeChannel" :channel="activeChannel" class="members" :class="{ open: membersOpen }" />
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

.safety {
  margin-left: auto;
  color: var(--text-faint);
  font-size: 0.75rem;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .safety {
    display: none;
  }
}

.hash {
  flex-shrink: 0;
  color: var(--text-faint);
}

.menu,
.members-toggle {
  display: none;
}

.members {
  width: 240px;
  flex-shrink: 0;
}

@media (max-width: 1000px) {
  .members-toggle {
    display: inline-flex;
    margin-left: auto;
  }

  .members {
    display: none;
  }

  .members.open {
    display: block;
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 20;
    width: min(260px, 85vw);
  }
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
