<script setup lang="ts">
import { ref } from 'vue';
import { useImageUploads } from '@/composables/useImageUploads';
import type { Thread } from '@/services/crypto/keyring';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { errorMessage } from '@/utils/errors';
import { validateImageFile } from '@/utils/images';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ thread: Thread; placeholder: string }>();

const auth = useAuthStore();
const messages = useMessageStore();
const { uploads, uploadError, start } = useImageUploads();

const text = ref('');
const sending = ref(false);
const error = ref<string | null>(null);
const dragging = ref(false);
const fileInput = ref<HTMLInputElement>();

/** Sends the typed message, restoring the text when it fails. */
async function send(): Promise<void> {
  const content = text.value.trim();
  if (!content || sending.value) return;
  sending.value = true;
  error.value = null;
  text.value = '';
  try {
    await messages.send(props.thread, (auth.user as { id: number }).id, content);
  } catch (err) {
    text.value = content;
    error.value = errorMessage(err, 'Could not send the message');
  } finally {
    sending.value = false;
  }
}

/** Sends on Enter; Shift+Enter inserts a new line. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void send();
  }
}

/** Starts uploading each valid file, using the typed text as the first caption. */
function addFiles(files: Iterable<File>): void {
  error.value = null;
  for (const file of files) {
    const problem = validateImageFile(file);
    if (problem) {
      error.value = `${file.name}: ${problem}`;
      continue;
    }
    void start(props.thread, file, text.value.trim());
    text.value = '';
  }
}

/** Handles the file picker. */
function onFilePicked(): void {
  addFiles(fileInput.value?.files ?? []);
  if (fileInput.value) fileInput.value.value = '';
}

/** Uploads images pasted from the clipboard. */
function onPaste(event: ClipboardEvent): void {
  const files = [...(event.clipboardData?.files ?? [])];
  if (files.length > 0) {
    event.preventDefault();
    addFiles(files);
  }
}

/** Uploads images dropped on the composer. */
function onDrop(event: DragEvent): void {
  dragging.value = false;
  addFiles(event.dataTransfer?.files ?? []);
}
</script>

<template>
  <div class="composer">
    <ul v-if="uploads.length" class="uploads">
      <li v-for="upload in uploads" :key="upload.id">
        <div class="upload-info">
          <span class="filename">{{ upload.filename }}</span>
          <span class="percent">{{ Math.round(upload.progress * 100) }}% of {{ upload.sizeLabel }}</span>
          <button class="icon-btn small" :aria-label="`Cancel upload of ${upload.filename}`" @click="upload.cancel()">
            <AppIcon name="close" :size="15" />
          </button>
        </div>
        <progress :value="upload.progress" max="1" :aria-label="`Uploading ${upload.filename}`" />
      </li>
    </ul>
    <p v-if="error || uploadError" class="form-error" role="alert">{{ error ?? uploadError }}</p>

    <form
      class="box"
      :class="{ dragging }"
      @submit.prevent="send"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <button type="button" class="icon-btn" aria-label="Attach image" title="Attach image (max 1 GB)" @click="fileInput?.click()">
        <AppIcon name="image" />
      </button>
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp" multiple hidden @change="onFilePicked" />
      <textarea
        v-model="text"
        rows="1"
        maxlength="4000"
        :placeholder="placeholder"
        :aria-label="placeholder"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <button class="icon-btn send" aria-label="Send message" :disabled="!text.trim() || sending">
        <AppIcon name="send" />
      </button>
    </form>
  </div>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 16px calc(0.85rem + env(safe-area-inset-bottom));
}

.box {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  padding: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-raised);
}

.box.dragging {
  border-color: var(--accent);
}

textarea {
  flex: 1;
  min-width: 0;
  max-height: 160px;
  padding: 0.38rem 0.25rem;
  border: none;
  outline: none;
  background: none;
  field-sizing: content;
  resize: none;
}

textarea::placeholder {
  color: var(--text-faint);
}

.send:not(:disabled) {
  color: var(--accent);
}

.uploads {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
}

.upload-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.percent {
  flex-shrink: 0;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.small {
  width: 26px;
  height: 26px;
}

progress {
  display: block;
  width: 100%;
  height: 4px;
  accent-color: var(--accent);
}
</style>
