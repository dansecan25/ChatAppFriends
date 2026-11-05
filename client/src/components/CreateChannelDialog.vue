<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useChannelStore } from '@/stores/channelStore';
import type { ChannelType } from '@/types/dto';
import type { Channel } from '@/types/models';
import { errorMessage } from '@/utils/errors';

const props = defineProps<{ type: ChannelType }>();
const emit = defineEmits<{ close: []; created: [channel: Channel] }>();

const channels = useChannelStore();
const dialog = ref<HTMLDialogElement>();
const name = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

/** Creates the channel and reports it to the parent. */
async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    emit('created', await channels.createChannel(name.value, props.type));
  } catch (err) {
    error.value = errorMessage(err, 'Could not create the channel');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => dialog.value?.showModal());
</script>

<template>
  <dialog ref="dialog" @close="emit('close')">
    <form @submit.prevent="submit">
      <h2>New {{ type }} channel</h2>
      <label class="field">
        Channel name
        <input v-model="name" required maxlength="50" autofocus :placeholder="type === 'text' ? 'game-night' : 'Lounge'" />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="actions">
        <button type="button" class="btn" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="submitting">Create channel</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-main);
  color: var(--text);
}

dialog::backdrop {
  background: rgb(0 0 0 / 60%);
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.2rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
