<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useChannelStore } from '@/stores/channelStore';
import { useServerStore } from '@/stores/serverStore';
import type { ChannelType } from '@/types/dto';
import type { Channel } from '@/types/models';
import { errorMessage } from '@/utils/errors';

const props = defineProps<{ type: ChannelType }>();
const emit = defineEmits<{ close: []; created: [channel: Channel] }>();

const auth = useAuthStore();
const channels = useChannelStore();
const servers = useServerStore();
const dialog = ref<HTMLDialogElement>();
const name = ref('');
const roleIds = ref<number[]>([]);
const error = ref<string | null>(null);
const submitting = ref(false);

/** Creates the channel and reports it to the parent. */
async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    emit(
      'created',
      await channels.createChannel(
        servers.activeId as number,
        name.value,
        props.type,
        roleIds.value,
        servers.members,
        (auth.user as { id: number }).id,
      ),
    );
  } catch (err) {
    error.value = errorMessage(err, 'Could not create the channel');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => dialog.value?.showModal());
</script>

<template>
  <dialog ref="dialog" class="modal" @close="emit('close')">
    <form class="modal-body" @submit.prevent="submit">
      <h2>New {{ type }} channel</h2>
      <label class="field">
        Channel name
        <input v-model="name" required maxlength="50" autofocus :placeholder="type === 'text' ? 'game-night' : 'Lounge'" />
      </label>
      <fieldset v-if="servers.roles.length" class="roles">
        <legend>Limit to these roles (optional)</legend>
        <div class="choices">
          <label v-for="role in servers.roles" :key="role.id">
            <input v-model="roleIds" type="checkbox" :value="role.id" />{{ role.name }}
          </label>
        </div>
        <p class="hint">
          Without roles, everyone in the server can join. With roles, only those people and you can, and no one else can
          read its messages, including admins and the owner.
        </p>
      </fieldset>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="btn" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="submitting">Create channel</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.roles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: none;
}

legend {
  padding: 0 0 0.35rem;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
