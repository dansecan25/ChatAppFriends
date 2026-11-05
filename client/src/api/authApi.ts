import type { LoginDto, ProfileDto } from '@/types/dto';
import { request } from './http';

export interface AccountKeys {
  kdfSalt: string;
  publicKey: string;
  wrappedPrivateKey: string;
  recoveryWrappedPrivateKey: string;
  recoveryVerifier: string;
}

/** Returns the signed-in user. */
export const fetchCurrentUser = (): Promise<ProfileDto> => request('/auth/me');

/** Returns what's needed to derive a user's login key. */
export const prelogin = (username: string): Promise<{ salt: string; legacy: boolean }> =>
  request('/auth/prelogin', { method: 'POST', body: { username } });

/** Signs in with a login key, or a password for an account from before encryption. */
export const login = (username: string, secret: { authKey: string } | { password: string }): Promise<LoginDto> =>
  request('/auth/login', { method: 'POST', body: { username, ...secret } });

/** Creates an account with an invite code. */
export const register = (body: {
  username: string;
  authKey: string;
  keys: AccountKeys;
  inviteCode: string;
}): Promise<ProfileDto> => request('/auth/register', { method: 'POST', body });

/** Adds keys to an account from before encryption. */
export const upgrade = (authKey: string, keys: AccountKeys): Promise<void> =>
  request('/auth/upgrade', { method: 'POST', body: { authKey, keys } });

/** Fetches the private key copy protected by a recovery key. */
export const fetchRecoveryKey = (username: string, verifier: string): Promise<{ recoveryWrappedPrivateKey: string }> =>
  request('/auth/recovery-key', { method: 'POST', body: { username, verifier } });

/** Sets a new password using a recovery key. */
export const recover = (body: {
  username: string;
  verifier: string;
  authKey: string;
  kdfSalt: string;
  wrappedPrivateKey: string;
}): Promise<LoginDto> => request('/auth/recover', { method: 'POST', body });

/** Ends the current session. */
export const logout = (): Promise<void> => request('/auth/logout', { method: 'POST' });
