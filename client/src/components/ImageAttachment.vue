<script setup lang="ts">
import { ref } from 'vue';
import type { MessageImage } from '@/types/models';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ image: MessageImage }>();
defineEmits<{ loaded: [] }>();

const showImage = ref(!props.image.loadsOnDemand);
const failed = ref(false);
</script>

<template>
  <figure class="attachment">
    <a v-if="showImage && !failed" :href="image.url" target="_blank" rel="noopener">
      <img :src="image.url" :alt="image.filename" loading="lazy" @load="$emit('loaded')" @error="failed = true" />
    </a>
    <div v-else class="placeholder">
      <AppIcon name="image" :size="28" />
      <div class="meta">
        <span class="filename">{{ image.filename }}</span>
        <span>{{ failed ? 'This image could not be displayed' : image.sizeLabel }}</span>
      </div>
      <button v-if="!failed" class="btn" @click="showImage = true">Load image</button>
    </div>
    <figcaption>
      <span class="filename">{{ image.filename }}</span>
      <span class="size">{{ image.sizeLabel }}</span>
      <a :href="image.downloadUrl" class="download" :aria-label="`Download ${image.filename}`" title="Download">
        <AppIcon name="download" :size="15" />
      </a>
    </figcaption>
  </figure>
</template>

<style scoped>
.attachment {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: min(480px, 100%);
  margin: 0.35rem 0 0.15rem;
}

img {
  display: block;
  max-width: 100%;
  max-height: 380px;
  border-radius: var(--radius);
  background: var(--bg-raised);
}

.placeholder {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-sidebar);
  color: var(--text-muted);
}

.meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 120px;
  font-size: 0.85rem;
}

figcaption {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-faint);
  font-size: 0.78rem;
}

.filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size {
  flex-shrink: 0;
}

.download {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--text-muted);
}
</style>
