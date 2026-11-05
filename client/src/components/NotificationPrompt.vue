<script setup lang="ts">
import { useNotificationStore } from '@/stores/notificationStore';

const notifications = useNotificationStore();
</script>

<template>
  <div v-if="notifications.showPrompt" class="prompt" role="status">
    <span>Get a notification for new messages while this tab is open?</span>
    <span class="actions">
      <button class="btn" @click="notifications.dismissPrompt">Not now</button>
      <button class="btn btn-primary" @click="notifications.enable">Turn on</button>
    </span>
  </div>
</template>

<style scoped>
.prompt {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.5rem 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-raised);
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}
</style>
