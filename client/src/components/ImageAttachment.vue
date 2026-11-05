<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { downloadEncryptedFile } from '@/services/crypto/fileCrypto';
import type { MessageImage } from '@/types/models';
import { sniffBlobType } from '@/utils/images';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ image: MessageImage }>();
defineEmits<{ loaded: [] }>();

const showImage = ref(!props.image.loadsOnDemand);
const failed = ref(false);
const decryptedUrl = ref<string | null>(null);
const saving = ref(false);

const legacy = computed(() => (props.image.source.kind === 'legacy' ? props.image.source : null));
const displayUrl = computed(() => legacy.value?.url ?? decryptedUrl.value);

/** Downloads and decrypts the file, refusing anything that isn't a safe image once opened. */
async function decryptToBlob(): Promise<Blob> {
  const { source } = props.image;
  if (source.kind !== 'encrypted') throw new Error('Not an encrypted file');
  const blob = await downloadEncryptedFile(source.attachmentId, source.file, source.file.mimeType);
  const type = await sniffBlobType(blob);
  if (!type) throw new Error('Not a supported image');
  return blob.slice(0, blob.size, type);
}

/** Decrypts the image once it should be shown. */
async function load(): Promise<void> {
  if (legacy.value || decryptedUrl.value) return;
  try {
    decryptedUrl.value = URL.createObjectURL(await decryptToBlob());
  } catch {
    failed.value = true;
  }
}

/** Saves the decrypted file to the user's device. */
async function save(): Promise<void> {
  saving.value = true;
  try {
    const url = decryptedUrl.value ?? URL.createObjectURL(await decryptToBlob());
    const link = document.createElement('a');
    link.href = url;
    link.download = props.image.filename;
    link.click();
    if (url !== decryptedUrl.value) setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    failed.value = true;
  } finally {
    saving.value = false;
  }
}

watch(showImage, (show) => show && load(), { immediate: true });

onBeforeUnmount(() => {
  if (decryptedUrl.value) URL.revokeObjectURL(decryptedUrl.value);
});
</script>

<template>
  <figure class="attachment">
    <a v-if="showImage && !failed && displayUrl" :href="displayUrl" target="_blank" rel="noopener">
      <img :src="displayUrl" :alt="image.filename" loading="lazy" @load="$emit('loaded')" @error="failed = true" />
    </a>
    <div v-else class="placeholder">
      <AppIcon name="image" :size="28" />
      <div class="meta">
        <span class="filename">{{ image.filename }}</span>
        <span>{{ failed ? 'This image could not be displayed' : showImage ? 'Decrypting…' : image.sizeLabel }}</span>
      </div>
      <button v-if="!failed && !showImage" class="btn" @click="showImage = true">Load image</button>
    </div>
    <figcaption>
      <span class="filename">{{ image.filename }}</span>
      <span class="size">{{ image.sizeLabel }}</span>
      <a v-if="legacy" :href="legacy.downloadUrl" class="download" :aria-label="`Download ${image.filename}`" title="Download">
        <AppIcon name="download" :size="15" />
      </a>
      <button v-else class="download" :disabled="saving" :aria-label="`Download ${image.filename}`" title="Download" @click="save">
        <AppIcon name="download" :size="15" />
      </button>
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
