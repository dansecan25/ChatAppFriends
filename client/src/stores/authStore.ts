import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as authApi from '@/api/authApi';
import { ApiError } from '@/api/http';
import * as serverApi from '@/api/serverApi';
import { clearKeyring } from '@/services/crypto/keyring';
import {
  clearIdentity,
  createAccountKeys,
  loadIdentity,
  rewrapWithRecovery,
  saveIdentity,
  unlockPrivateKey,
} from '@/services/crypto/identity';
import { codeVerifier, deriveFromPassword } from '@/services/crypto/primitives';
import type { ProfileDto } from '@/types/dto';
import type { Profile } from '@/types/models';

const toProfile = ({ id, username, isOwner }: ProfileDto): Profile => ({ id, username, isOwner });

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Profile | null>(null);
  const checked = ref(false);
  /** Shown once after signup, then forgotten. */
  const pendingRecoveryCode = ref<string | null>(null);

  /** Restores the session once per page load. A session without this device's keys has to sign in again. */
  async function restoreSession(): Promise<void> {
    if (checked.value) return;
    const profile = await authApi.fetchCurrentUser().catch(() => null);
    if (profile && !profile.needsKeySetup && (await loadIdentity(profile.id))) user.value = toProfile(profile);
    else if (profile) await authApi.logout().catch(() => undefined);
    checked.value = true;
  }

  /** Signs in. Accounts from before encryption get their keys here, the one time their password is sent. */
  async function login(username: string, password: string): Promise<void> {
    const { salt, legacy } = await authApi.prelogin(username);
    if (legacy) {
      const { user: profile } = await authApi.login(username, { password });
      const created = await createAccountKeys(password);
      await authApi.upgrade(created.authKey, created.keys);
      await saveIdentity({ userId: profile.id, publicKey: created.publicKey, privateKey: created.privateKey });
      pendingRecoveryCode.value = created.recoveryCode;
      user.value = toProfile(profile);
      return;
    }
    const { authKey, wrappingKey } = await deriveFromPassword(password, salt);
    const { user: profile, keys } = await authApi.login(username, { authKey });
    if (!keys) throw new ApiError(500, 'This account has no keys');
    const privateKey = await unlockPrivateKey(wrappingKey, keys.wrappedPrivateKey);
    await saveIdentity({ userId: profile.id, publicKey: keys.publicKey, privateKey });
    user.value = toProfile(profile);
  }

  /** Creates an account with an invite code. */
  async function register(username: string, password: string, inviteCode: string): Promise<void> {
    const created = await createAccountKeys(password);
    const profile = await authApi.register({
      username,
      authKey: created.authKey,
      keys: created.keys,
      inviteCode: inviteCode.trim(),
    });
    await saveIdentity({ userId: profile.id, publicKey: created.publicKey, privateKey: created.privateKey });
    pendingRecoveryCode.value = created.recoveryCode;
    user.value = toProfile(profile);
  }

  /** Joins a server using an invite code while signed in. The master code can make this account the owner. */
  async function redeem(inviteCode: string): Promise<void> {
    await serverApi.redeemCode(inviteCode.trim());
    user.value = toProfile(await authApi.fetchCurrentUser());
  }

  /** Sets a new password with a recovery key, keeping access to all messages. */
  async function recover(username: string, recoveryCode: string, newPassword: string): Promise<void> {
    const code = recoveryCode.trim();
    const verifier = await codeVerifier(code);
    const { recoveryWrappedPrivateKey } = await authApi.fetchRecoveryKey(username, verifier);
    const { privateKey, ...newLogin } = await rewrapWithRecovery(code, recoveryWrappedPrivateKey, newPassword);
    const { user: profile, keys } = await authApi.recover({ username, verifier, ...newLogin });
    if (!keys) throw new ApiError(500, 'This account has no keys');
    await saveIdentity({ userId: profile.id, publicKey: keys.publicKey, privateKey });
    user.value = toProfile(profile);
  }

  /** Signs out and removes the keys from this device. */
  async function logout(): Promise<void> {
    await authApi.logout();
    await clearIdentity();
    clearKeyring();
    user.value = null;
  }

  return { user, pendingRecoveryCode, restoreSession, login, register, redeem, recover, logout };
});
