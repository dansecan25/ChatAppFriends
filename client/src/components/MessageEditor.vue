<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Thread } from '@/services/crypto/keyring';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import type { Message } from '@/types/models';
import { errorMessage } from '@/utils/errors';
import MentionTextarea from './MentionTextarea.vue';

const props = defineProps<{ message: Message; thread: Thread }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const messages = useMessageStore();

const field = ref<InstanceType<typeof MentionTextarea>>();
const draft = ref('');
const original = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

/** A message with an image can lose its caption. One with only text must be deleted instead. */
const canSave = computed(() => !saving.value && (!!draft.value.trim() || !!props.message.image));

/** Saves the new text, keeping the editor open if that fails. */
async function save(): Promise<void> {
  if (!canSave.value || !field.value) return;
  const content = draft.value.trim();
  if (content === original.value) return emit('close');
  saving.value = true;
  error.value = null;
  try {
    await messages.edit(props.thread, props.message, (auth.user as { id: number }).id, field.value.encode(content));
    emit('close');
  } catch (err) {
    error.value = errorMessage(err, 'Could not save the message');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  original.value = field.value?.decode(props.message.content) ?? '';
  draft.value = original.value;
  field.value?.focus();
});
</script>

<template>
  <form class="editor" @submit.prevent="save">
    <div class="box">
      <MentionTextarea
        ref="field"
        v-model="draft"
        :thread="thread"
        aria-label="Edit message"
        @submit="save"
        @cancel="emit('close')"
      />
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="buttons">
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" :disabled="!canSave">Save</button>
    </div>
  </form>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0.2rem 0;
}

.box {
  position: relative;
  display: flex;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-raised);
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}
</style>
