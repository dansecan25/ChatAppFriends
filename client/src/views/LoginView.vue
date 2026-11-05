<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import PasswordInput from '@/components/PasswordInput.vue';
import { useAuthStore } from '@/stores/authStore';
import { offerToSaveLogin } from '@/utils/credentials';
import { errorMessage } from '@/utils/errors';

const auth = useAuthStore();
const router = useRouter();

const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const inviteCode = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

const isRegister = computed(() => mode.value === 'register');

/** Switches between signing in and creating an account. */
function toggleMode(): void {
  mode.value = isRegister.value ? 'login' : 'register';
  error.value = null;
}

/** Submits the form and opens the chat. */
async function submit(): Promise<void> {
  submitting.value = true;
  error.value = null;
  try {
    if (isRegister.value) await auth.register(username.value, password.value, inviteCode.value);
    else await auth.login(username.value, password.value);
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
      <h1>{{ isRegister ? 'Join your friends' : 'Welcome back' }}</h1>
      <label class="field">
        Username
        <input v-model="username" name="username" autocomplete="username" required maxlength="32" autofocus />
      </label>
      <label class="field">
        Password
        <PasswordInput
          v-model="password"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
          required
          :minlength="isRegister ? 8 : 1"
        />
      </label>
      <label v-if="isRegister" class="field">
        Invite code
        <input v-model="inviteCode" autocomplete="off" required />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" :disabled="submitting">
        {{ isRegister ? 'Create account' : 'Sign in' }}
      </button>
      <button type="button" class="switch" @click="toggleMode">
        {{ isRegister ? 'Already have an account? Sign in' : 'Have an invite code? Create an account' }}
      </button>
      <RouterLink v-if="!isRegister" class="switch" :to="{ name: 'recover' }">Forgot your password?</RouterLink>
    </form>
  </main>
</template>

