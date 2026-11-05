<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserDisplay } from '@/composables/useUserDisplay';
import { useAuthStore } from '@/stores/authStore';
import { useChannelStore } from '@/stores/channelStore';
import type { Message } from '@/types/models';
import { mentionsUser, parseMentions } from '@/utils/mentions';
import AppIcon from './AppIcon.vue';
import ImageAttachment from './ImageAttachment.vue';
import UserAvatar from './UserAvatar.vue';

const props = defineProps<{ message: Message; grouped: boolean }>();

const router = useRouter();
const auth = useAuthStore();
const channels = useChannelStore();
const { nameFor, avatarFor } = useUserDisplay();

const inDm = computed(() => props.message.threadKey.startsWith('d'));
const readable = computed(() => props.message.protection !== 'locked');
const parts = computed(() =>
  readable.value ? parseMentions(props.message.content) : [{ kind: 'text' as const, text: props.message.content }],
);
const mentionsMe = computed(() => readable.value && mentionsUser(props.message.content, auth.user?.id ?? 0));

/** Nicknames belong to a server, so DMs always show the account name. */
const authorName = computed(() =>
  inDm.value
    ? props.message.author.username
    : nameFor(props.message.author.id, props.message.author.username),
);
defineEmits<{ imageLoaded: [] }>();
</script>

<template>
  <article class="message" :class="{ grouped, mentioned: mentionsMe }">
    <UserAvatar v-if="!grouped" :user-id="message.author.id" :username="authorName" :avatar-id="avatarFor(message.author.id)" />
    <div class="body">
      <header v-if="!grouped">
        <strong :title="message.author.username">{{ authorName }}</strong>
        <time :datetime="message.createdAt.toISOString()">{{ message.timeLabel }}</time>
        <span v-if="message.protection === 'legacy'" class="legacy" title="Sent before encryption, so the server can read it">
          <AppIcon name="unlock" :size="12" /> Not encrypted
        </span>
      </header>
      <p v-if="message.content" class="content" :class="{ locked: !readable }">
        <template v-for="(part, index) in parts" :key="index">
          <template v-if="part.kind === 'text'">{{ part.text }}</template>
          <span v-else-if="part.kind === 'user'" class="mention">@{{ inDm ? part.name : nameFor(part.id, part.name) }}</span>
          <button
            v-else-if="channels.findKnown(part.id)"
            class="mention link"
            @click="router.push({ name: 'chat', params: { channelId: part.id } })"
          >#{{ channels.findKnown(part.id)?.name }}</button>
          <span v-else class="mention">#private-channel</span>
        </template>
      </p>
      <ImageAttachment v-if="message.image" :image="message.image" @loaded="$emit('imageLoaded')" />
    </div>
  </article>
</template>

<style scoped>
.message {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.8rem;
  padding: 0.1rem 16px;
}

.message:hover {
  background: rgb(255 255 255 / 2.5%);
}

.mentioned,
.mentioned:hover {
  box-shadow: inset 2px 0 var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.mention {
  padding: 0 0.2em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent-strong);
  font-weight: 600;
}

.mention.link {
  border: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.grouped {
  margin-top: 0;
  padding-left: calc(16px + 38px + 0.75rem);
}

.body {
  flex: 1;
  min-width: 0;
}

header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}

time {
  color: var(--text-faint);
  font-size: 0.75rem;
}

.legacy {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--text-faint);
  font-size: 0.72rem;
}

.locked {
  color: var(--text-faint);
  font-style: italic;
}

.content {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
