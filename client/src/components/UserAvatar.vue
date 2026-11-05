<script setup lang="ts">
import { computed, ref } from 'vue';
import { API_URL } from '@/utils/env';
import { avatarColor, avatarInitial } from '@/utils/avatar';

const props = defineProps<{
  userId: number;
  username: string;
  avatarId?: string | null;
  size?: number;
  speaking?: boolean;
}>();

const failedId = ref<string | null>(null);
const pictureUrl = computed(() =>
  props.avatarId && props.avatarId !== failedId.value ? `${API_URL}/api/avatars/${props.avatarId}` : null,
);

const style = computed(() => ({
  width: `${props.size ?? 38}px`,
  height: `${props.size ?? 38}px`,
  fontSize: `${(props.size ?? 38) * 0.45}px`,
  background: avatarColor(props.userId),
}));
</script>

<template>
  <span class="avatar" :class="{ speaking }" :style="style" aria-hidden="true">
    <img v-if="pictureUrl" :src="pictureUrl" alt="" @error="failedId = avatarId ?? null" />
    <template v-else>{{ avatarInitial(username) }}</template>
  </span>
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

img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.speaking {
  box-shadow: 0 0 0 2px var(--bg-sidebar), 0 0 0 4px var(--speaking);
}
</style>
