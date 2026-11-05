<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import * as profileApi from '@/api/profileApi';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { errorMessage } from '@/utils/errors';
import { toAvatarBlob } from '@/utils/images';
import UserAvatar from './UserAvatar.vue';

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const emit = defineEmits<{ close: [] }>();

const auth = useAuthStore();
const servers = useServerStore();

const dialog = ref<HTMLDialogElement>();
const fileInput = ref<HTMLInputElement>();
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const nickname = ref(servers.memberFor(auth.user?.id ?? 0)?.nickname ?? '');

const user = computed(() => auth.user);

/** Runs an action and shows any failure. */
async function attempt(action: () => Promise<void>, done: string): Promise<void> {
  error.value = null;
  notice.value = null;
  try {
    await action();
    notice.value = done;
  } catch (err) {
    error.value = errorMessage(err);
  }
}

/** Resizes the chosen picture in the browser and saves it. */
const onPicked = () => {
  const file = fileInput.value?.files?.[0];
  if (!file) return;
  void attempt(async () => {
    if (file.size > MAX_SOURCE_BYTES) throw new Error('Pictures can be at most 25 MB');
    await auth.setAvatar(await toAvatarBlob(file).catch(() => Promise.reject(new Error('That file is not a supported image'))));
    if (fileInput.value) fileInput.value.value = '';
  }, 'Profile picture saved.');
};

const removePicture = () => attempt(() => auth.setAvatar(null), 'Profile picture removed.');

const saveNickname = () =>
  attempt(async () => {
    await profileApi.putNickname(servers.activeId as number, nickname.value);
    await servers.fetchMembership();
  }, 'Nickname saved.');

onMounted(() => dialog.value?.showModal());
</script>

<template>
  <dialog ref="dialog" class="modal" @close="emit('close')">
    <div v-if="user" class="modal-body">
      <h2>Your profile</h2>

      <section class="picture">
        <UserAvatar :user-id="user.id" :username="user.username" :avatar-id="user.avatarId" :size="72" />
        <div class="modal-actions">
          <button class="btn" @click="fileInput?.click()">Change picture</button>
          <button v-if="user.avatarId" class="btn" @click="removePicture">Remove</button>
        </div>
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp" hidden @change="onPicked" />
      </section>
      <p class="hint">Only people who share a server with you can see it.</p>

      <p class="hint">Account name: <strong>{{ user.username }}</strong>. This is how you sign in, and it can't be changed.</p>

      <form v-if="servers.active" class="modal-body" @submit.prevent="saveNickname">
        <label class="field">
          Nickname in {{ servers.active.name }}
          <input v-model="nickname" maxlength="32" :placeholder="user.username" aria-label="Nickname" />
        </label>
        <p class="hint">Only applies in this server. Leave it empty to use your account name.</p>
        <div class="modal-actions"><button class="btn">Save nickname</button></div>
      </form>

      <p v-if="notice" class="hint" role="status">{{ notice }}</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="modal-actions"><button class="btn" @click="emit('close')">Close</button></div>
    </div>
  </dialog>
</template>

<style scoped>
.picture {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>
