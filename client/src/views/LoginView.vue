<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
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
    await router.push({ name: 'chat' });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login">
    <form class="card" @submit.prevent="submit">
      <h1>{{ isRegister ? 'Join your friends' : 'Welcome back' }}</h1>
      <label class="field">
        Username
        <input v-model="username" autocomplete="username" required maxlength="32" autofocus />
      </label>
      <label class="field">
        Password
        <input
          v-model="password"
          type="password"
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
    </form>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(400px, 100%);
  padding: 2rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-main);
}

h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.switch {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.switch:hover {
  color: var(--text);
  text-decoration: underline;
}
</style>
