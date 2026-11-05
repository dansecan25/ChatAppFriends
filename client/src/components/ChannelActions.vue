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

/* Shown on hover, and always on touch screens, which have no hover. */
.manage {
  opacity: 0;
}

:global(.row:hover) .manage,
:global(.row:focus-within) .manage {
  opacity: 1;
}

@media (hover: none) {
  .manage {
    opacity: 1;
  }
}
</style>
