<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { errorMessage } from '@/utils/errors';

const auth = useAuthStore();
const servers = useServerStore();
const router = useRouter();

const code = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

/** Joins with the code and opens the chat. */
async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    await auth.redeem(code.value);
    await servers.fetchServers();
    await router.push({ name: 'chat' });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    submitting.value = false;
  }
}

/** Signs out and returns to the login screen. */
async function logout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <main class="center-screen">
    <form class="card" @submit.prevent="submit">
      <h1>Join your server</h1>
      <p class="hint">Enter the invite code you were given.</p>
      <label class="field">Invite code<input v-model="code" autocomplete="off" required autofocus /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" :disabled="submitting">Join</button>
      <button type="button" class="switch" @click="logout">Sign out</button>
    </form>
  </main>
</template>
