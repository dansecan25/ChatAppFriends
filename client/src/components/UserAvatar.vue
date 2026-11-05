<script setup lang="ts">
import { computed } from 'vue';
import { avatarColor, avatarInitial } from '@/utils/avatar';

const props = defineProps<{ userId: number; username: string; size?: number; speaking?: boolean }>();

const style = computed(() => ({
  width: `${props.size ?? 38}px`,
  height: `${props.size ?? 38}px`,
  fontSize: `${(props.size ?? 38) * 0.45}px`,
  background: avatarColor(props.userId),
}));
</script>

<template>
  <span class="avatar" :class="{ speaking }" :style="style" aria-hidden="true">{{ avatarInitial(username) }}</span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  color: #14161c;
  font-weight: 700;
}

.speaking {
  box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 0 4px var(--speaking);
}
</style>
