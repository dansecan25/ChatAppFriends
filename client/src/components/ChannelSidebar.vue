<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useChannelStore } from '@/stores/channelStore';
import { useDmStore } from '@/stores/dmStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { useVoiceStore } from '@/stores/voiceStore';
import type { ChannelType, MemberDto } from '@/types/dto';
import type { Channel } from '@/types/models';
import { errorMessage } from '@/utils/errors';
import { useUserDisplay } from '@/composables/useUserDisplay';
import AppIcon from './AppIcon.vue';
import CreateChannelDialog from './CreateChannelDialog.vue';
import ProfileDialog from './ProfileDialog.vue';
import ServerSettingsDialog from './ServerSettingsDialog.vue';
import ServerSwitcher from './ServerSwitcher.vue';
import UserAvatar from './UserAvatar.vue';
import VoiceControls from './VoiceControls.vue';

const emit = defineEmits<{ navigate: [] }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const channels = useChannelStore();
const voice = useVoiceStore();
const servers = useServerStore();
const dms = useDmStore();
const messages = useMessageStore();

const { nameFor, avatarFor } = useUserDisplay();

const profileOpen = ref(false);
const settingsOpen = ref(false);
const pickingDm = ref(false);
const dialogType = ref<ChannelType | null>(null);
const actionError = ref<string | null>(null);

const activeId = computed(() => Number(route.params.channelId));
const activeDmId = computed(() => Number(route.params.dmId));
const canDelete = (channel: Channel) => channel.createdBy === auth.user?.id || servers.active?.isAdmin === true;
const dmCandidates = computed(() => servers.members.filter((member) => member.id !== auth.user?.id));

/** Opens a conversation. */
function openDm(dmId: number): void {
  void router.push({ name: 'dm', params: { dmId } });
  emit('navigate');
}

/** Starts or reopens a conversation with a member. */
async function startDm(member: MemberDto): Promise<void> {
  actionError.value = null;
  try {
    openDm((await dms.open(member)).id);
    pickingDm.value = false;
  } catch (err) {
    actionError.value = errorMessage(err, 'Could not start the conversation');
  }
}

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
  [servers, channels, dms, messages].forEach((store) => store.reset());
  await router.push({ name: 'login' });
}
</script>

<template>
  <aside class="wrap">
    <ServerSwitcher v-if="auth.user?.isOwner || servers.servers.length > 1" />
    <header v-if="servers.active" class="server-title">
      <strong class="name">{{ servers.active.name }}</strong>
      <button class="icon-btn small" aria-label="Server settings" title="Server settings" @click="settingsOpen = true">
        <AppIcon name="settings" :size="16" />
      </button>
    </header>
    <nav class="channels" aria-label="Channels">
      <template v-if="servers.active">
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
            :class="{ unread: channels.unread.has(`c${channel.id}`) }"
            :aria-current="channel.id === activeId ? 'page' : undefined"
            @click="openChannel(channel)"
          >
            <AppIcon :name="channel.restricted ? 'lock' : 'hash'" :size="17" />
            <span class="name">{{ channel.name }}</span>
            <span v-if="channels.unread.has(`c${channel.id}`)" class="dot" aria-label="Unread messages" />
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
                :username="nameFor(person.userId, person.username)"
                :avatar-id="avatarFor(person.userId)"
                :size="24"
                :speaking="voice.speakingUserIds.has(person.userId)"
              />
              <span class="name">{{ nameFor(person.userId, person.username) }}</span>
              <AppIcon v-if="person.deafened" name="headphonesOff" :size="15" class="state" />
              <AppIcon v-else-if="person.muted" name="micOff" :size="15" class="state" />
            </li>
          </ul>
        </template>
      </section>

      <section>
        <header class="section-title">
          <h2>Direct messages</h2>
          <button class="icon-btn small" aria-label="New direct message" @click="pickingDm = !pickingDm">
            <AppIcon name="plus" :size="16" />
          </button>
        </header>
        <ul v-if="pickingDm" class="picker">
          <li v-for="member in dmCandidates" :key="member.id">
            <button class="channel" @click="startDm(member)">
              <UserAvatar :user-id="member.id" :username="nameFor(member.id, member.username)" :avatar-id="member.avatarId" :size="24" />
              <span class="name">{{ nameFor(member.id, member.username) }}</span>
            </button>
          </li>
          <li v-if="dmCandidates.length === 0" class="hint">No one else is in this server yet.</li>
        </ul>
        <div v-for="dm in dms.dms" :key="dm.id" class="row" :class="{ active: dm.id === activeDmId }">
          <button class="channel" :class="{ unread: channels.unread.has(`d${dm.id}`) }" @click="openDm(dm.id)">
            <UserAvatar :user-id="dm.otherUser.id" :username="dm.otherUser.username" :avatar-id="dm.otherUser.avatarId" :size="24" />
            <span class="name">{{ dm.otherUser.username }}</span>
            <span v-if="channels.unread.has(`d${dm.id}`)" class="dot" aria-label="Unread messages" />
          </button>
        </div>
      </section>
      </template>

      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    </nav>

    <VoiceControls />

    <footer v-if="auth.user" class="me">
      <UserAvatar :user-id="auth.user.id" :username="nameFor(auth.user.id, auth.user.username)" :avatar-id="auth.user.avatarId" :size="30" />
      <span class="who">
        <span class="name">{{ nameFor(auth.user.id, auth.user.username) }}</span>
        <span v-if="nameFor(auth.user.id, auth.user.username) !== auth.user.username" class="account">{{ auth.user.username }}</span>
      </span>
      <button class="icon-btn" aria-label="Edit profile" title="Edit profile" @click="profileOpen = true">
        <AppIcon name="settings" :size="18" />
      </button>
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
    <ServerSettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
    <ProfileDialog v-if="profileOpen" @close="profileOpen = false" />
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

.server-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 52px;
  padding: 0 0.6rem 0 0.9rem;
  border-bottom: 1px solid var(--border);
}

.picker {
  margin: 0 0 0.35rem;
  padding: 0;
  list-style: none;
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

.who {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.account {
  overflow: hidden;
  color: var(--text-faint);
  font-size: 0.72rem;
  font-weight: 400;
  line-height: 1.2;
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
