<script setup lang="ts">
import type { Message } from '@/types/models';
import ImageAttachment from './ImageAttachment.vue';
import UserAvatar from './UserAvatar.vue';

defineProps<{ message: Message; grouped: boolean }>();
defineEmits<{ imageLoaded: [] }>();
</script>

<template>
  <article class="message" :class="{ grouped }">
    <UserAvatar v-if="!grouped" :user-id="message.author.id" :username="message.author.username" />
    <div class="body">
      <header v-if="!grouped">
        <strong>{{ message.author.username }}</strong>
        <time :datetime="message.createdAt.toISOString()">{{ message.timeLabel }}</time>
      </header>
      <p v-if="message.content" class="content">{{ message.content }}</p>
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

.content {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
