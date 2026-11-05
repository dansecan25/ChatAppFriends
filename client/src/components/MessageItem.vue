<script setup lang="ts">
import { computed } from 'vue';
import { useUserDisplay } from '@/composables/useUserDisplay';
import type { Message } from '@/types/models';
import AppIcon from './AppIcon.vue';
import ImageAttachment from './ImageAttachment.vue';
import UserAvatar from './UserAvatar.vue';

const props = defineProps<{ message: Message; grouped: boolean }>();

const { nameFor, avatarFor } = useUserDisplay();

/** Nicknames belong to a server, so DMs always show the account name. */
const authorName = computed(() =>
  props.message.threadKey.startsWith('d')
    ? props.message.author.username
    : nameFor(props.message.author.id, props.message.author.username),
);
defineEmits<{ imageLoaded: [] }>();
</script>

<template>
  <article class="message" :class="{ grouped }">
    <UserAvatar v-if="!grouped" :user-id="message.author.id" :username="authorName" :avatar-id="avatarFor(message.author.id)" />
    <div class="body">
      <header v-if="!grouped">
        <strong :title="message.author.username">{{ authorName }}</strong>
        <time :datetime="message.createdAt.toISOString()">{{ message.timeLabel }}</time>
        <span v-if="message.protection === 'legacy'" class="legacy" title="Sent before encryption, so the server can read it">
          <AppIcon name="unlock" :size="12" /> Not encrypted
        </span>
      </header>
      <p v-if="message.content" class="content" :class="{ locked: message.protection === 'locked' }">{{ message.content }}</p>
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
