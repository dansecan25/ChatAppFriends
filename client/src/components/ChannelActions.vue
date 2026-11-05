<script setup lang="ts">
import AppIcon from './AppIcon.vue';

defineProps<{ name: string }>();
defineEmits<{ rename: []; remove: [] }>();
</script>

<template>
  <button class="icon-btn small manage" :aria-label="`Rename ${name}`" title="Rename" @click="$emit('rename')">
    <AppIcon name="pencil" :size="15" />
  </button>
  <button class="icon-btn small manage" :aria-label="`Delete ${name}`" title="Delete" @click="$emit('remove')">
    <AppIcon name="trash" :size="15" />
  </button>
</template>

<style scoped>
.small {
  width: 26px;
  height: 26px;
}

/* ChannelSidebar shows these when their row is hovered. Touch screens have no hover, so there they always show. */
.manage {
  opacity: 0;
}

@media (hover: none) {
  .manage {
    opacity: 1;
  }
}
</style>
