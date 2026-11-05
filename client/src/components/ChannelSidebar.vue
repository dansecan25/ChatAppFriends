<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useChannelStore } from '@/stores/channelStore';
import { useVoiceStore } from '@/stores/voiceStore';
import type { ChannelType } from '@/types/dto';
import type { Channel } from '@/types/models';
import { errorMessage } from '@/utils/errors';
import AppIcon from './AppIcon.vue';
import CreateChannelDialog from './CreateChannelDialog.vue';
import UserAvatar from './UserAvatar.vue';
import VoiceControls from './VoiceControls.vue';

const emit = defineEmits<{ navigate: [] }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const channels = useChannelStore();
const voice = useVoiceStore();

const dialogType = ref<ChannelType | null>(null);
const actionError = ref<string | null>(null);

const activeId = computed(() => Number(route.params.channelId));
const canDelete = (channel: Channel) => channel.createdBy === auth.user?.id;

/** Opens a text channel. */
function openChannel(channel: Channel): void {
  void router.push({ name: 'chat', params: { channelId: channel.id } });
  emit('navigate');
}

/** Opens a newly created channel, or joins it when it is a voice channel. */
function onCreated(channel: Channel): void {
  dialogType.value = null;
  if (channel.type === 'text') openChannel(channel);
  else void voice.join(channel.id);
}

/** Deletes a channel after confirmation. */
async function removeChannel(channel: Channel): Promise<void> {
  const warning =
    channel.type === 'text'
      ? `Delete #${channel.name}? All of its messages and images will be permanently removed.`
      : `Delete the voice channel "${channel.name}"? Anyone in it will be disconnected.`;
  if (!window.confirm(warning)) return;
  actionError.value = null;
  try {
    await channels.deleteChannel(channel.id);
  } catch (err) {
    actionError.value = errorMessage(err, 'Could not delete the channel');
  }
}

/** Signs out and returns to the login screen. */
async function logout(): Promise<void> {
  await voice.leave();
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <aside class="wrap">
    <nav class="channels" aria-label="Channels">
      <section>
        <header class="section-title">
          <h2>Text channels</h2>
          <button class="icon-btn small" aria-label="Create text channel" @click="dialogType = 'text'">
            <AppIcon name="plus" :size="16" />
          </button>
        </header>
        <div v-for="channel in channels.textChannels" :key="channel.id" class="row" :class="{ active: channel.id === activeId }">
          <button
            class="channel"
            :class="{ unread: channels.unread.has(channel.id) }"
            :aria-current="channel.id === activeId ? 'page' : undefined"
            @click="openChannel(channel)"
          >
            <AppIcon name="hash" :size="17" />
            <span class="name">{{ channel.name }}</span>
            <span v-if="channels.unread.has(channel.id)" class="dot" aria-label="Unread messages" />
          </button>
          <button
            v-if="canDelete(channel)"
            class="icon-btn small delete"
            :aria-label="`Delete ${channel.name}`"
            @click="removeChannel(channel)"
          >
            <AppIcon name="trash" :size="15" />
          </button>
        </div>
      </section>

      <section>
        <header class="section-title">
          <h2>Voice channels</h2>
          <button class="icon-btn small" aria-label="Create voice channel" @click="dialogType = 'voice'">
            <AppIcon name="plus" :size="16" />
          </button>
        </header>
        <template v-for="channel in channels.voiceChannels" :key="channel.id">
          <div class="row" :class="{ active: channel.id === voice.channelId }">
            <button class="channel" @click="voice.join(channel.id)">
              <AppIcon name="speaker" :size="17" />
              <span class="name">{{ channel.name }}</span>
            </button>
            <button
              v-if="canDelete(channel)"
              class="icon-btn small delete"
              :aria-label="`Delete ${channel.name}`"
              @click="removeChannel(channel)"
            >
              <AppIcon name="trash" :size="15" />
            </button>
          </div>
          <ul v-if="voice.rosters[channel.id]?.length" class="roster">
            <li v-for="person in voice.rosters[channel.id]" :key="person.userId">
              <UserAvatar
                :user-id="person.userId"
                :username="person.username"
                :size="24"
                :speaking="voice.speakingUserIds.has(person.userId)"
              />
              <span class="name">{{ person.username }}</span>
              <AppIcon v-if="person.deafened" name="headphonesOff" :size="15" class="state" />
              <AppIcon v-else-if="person.muted" name="micOff" :size="15" class="state" />
            </li>
          </ul>
        </template>
      </section>

      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </nav>

    <VoiceControls />

    <footer v-if="auth.user" class="me">
      <UserAvatar :user-id="auth.user.id" :username="auth.user.username" :size="30" />
      <span class="name">{{ auth.user.username }}</span>
      <button class="icon-btn" aria-label="Sign out" title="Sign out" @click="logout">
        <AppIcon name="logout" :size="18" />
      </button>
    </footer>

    <CreateChannelDialog
      v-if="dialogType"
      :type="dialogType"
      @close="dialogType = null"
      @created="onCreated"
    />
  </aside>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
}

.channels {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0.6rem;
}

section + section {
  margin-top: 1.1rem;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.1rem 0.25rem 0.5rem;
}

h2 {
  margin: 0;
  color: var(--text-faint);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.small {
  width: 28px;
  height: 28px;
}

.row {
  display: flex;
  align-items: center;
  border-radius: 8px;
  color: var(--text-muted);
}

.row:hover {
  background: var(--bg-raised);
  color: var(--text);
}

.row.active {
  background: var(--bg-hover);
  color: var(--text);
}

.channel {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  min-height: 36px;
  padding: 0.35rem 0.5rem;
  text-align: left;
}

.channel svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread {
  color: var(--text);
  font-weight: 700;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.delete {
  opacity: 0;
}

.row:hover .delete,
.delete:focus-visible {
  opacity: 1;
}

@media (hover: none) {
  .delete {
    opacity: 1;
  }
}

.roster {
  margin: 0.15rem 0 0.35rem;
  padding: 0 0 0 1.35rem;
  list-style: none;
}

.roster li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.22rem 0.4rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.state {
  flex-shrink: 0;
  color: var(--danger);
}

.me {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.6rem;
  border-top: 1px solid var(--border);
  background: var(--bg-deep);
  font-weight: 600;
}
</style>
