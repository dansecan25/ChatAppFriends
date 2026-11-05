<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import PasswordInput from '@/components/PasswordInput.vue';
import { useAuthStore } from '@/stores/authStore';
import { offerToSaveLogin } from '@/utils/credentials';
import { errorMessage } from '@/utils/errors';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const recoveryCode = ref('');
const password = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

/** Sets a new password and opens the chat. */
async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    await auth.recover(username.value, recoveryCode.value, password.value);
    await offerToSaveLogin(username.value, password.value);
    await router.push({ name: 'chat' });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="center-screen">
    <form class="card" @submit.prevent="submit">
      <h1>Recover your account</h1>
      <p class="hint">Your messages stay readable with the recovery key you saved when you signed up.</p>
      <label class="field">Username<input v-model="username" name="username" autocomplete="username" required maxlength="32" autofocus /></label>
      <label class="field">Recovery key<input v-model="recoveryCode" autocomplete="off" required /></label>
      <label class="field">New password<PasswordInput v-model="password" autocomplete="new-password" required minlength="8" /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" :disabled="submitting">Set new password</button>
      <RouterLink class="switch" :to="{ name: 'login' }">Back to sign in</RouterLink>
    </form>
  </main>
</template>
