<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';

const auth = useAuthStore();
const dialog = ref<HTMLDialogElement>();
const saved = ref(false);

onMounted(() => dialog.value?.showModal());
</script>

<template>
  <dialog ref="dialog" class="modal" @cancel.prevent>
    <div class="modal-body">
      <h2>Save your recovery key</h2>
      <p class="hint">
        If you forget your password, this is the only way back into your messages. No one, including the server's owner,
        can reset it for you. It won't be shown again.
      </p>
      <p class="secret-code">{{ auth.pendingRecoveryCode }}</p>
      <label class="choices"><span><input v-model="saved" type="checkbox" /> I saved it somewhere safe</span></label>
      <div class="modal-actions">
        <button class="btn btn-primary" :disabled="!saved" @click="auth.pendingRecoveryCode = null">Continue</button>
      </div>
    </div>
  </dialog>
</template>
