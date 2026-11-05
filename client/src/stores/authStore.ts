import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as authApi from '@/api/authApi';
import type { User } from '@/types/models';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const checked = ref(false);

  /** Restores the session once per page load. */
  async function restoreSession(): Promise<void> {
    if (checked.value) return;
    user.value = await authApi.fetchCurrentUser().catch(() => null);
    checked.value = true;
  }

  /** Signs in. */
  async function login(username: string, password: string): Promise<void> {
    user.value = await authApi.login(username, password);
  }

  /** Creates an account and signs in. */
  async function register(username: string, password: string, inviteCode: string): Promise<void> {
    user.value = await authApi.register(username, password, inviteCode);
  }

  /** Signs out. */
  async function logout(): Promise<void> {
    await authApi.logout();
    user.value = null;
  }

  return { user, restoreSession, login, register, logout };
});
