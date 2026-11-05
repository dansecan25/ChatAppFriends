import {
  deleteUser,
  findUserByUsername,
  insertUser,
  saveUserKeys,
  updateLogin,
  type AuthUser,
  type KeyBundle,
  type UserRecord,
} from '../models/userModel.js';
import { decoySalt, sha256Hex } from '../utils/fieldCrypto.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { applyCode, requireCode } from './inviteService.js';

const DUMMY_HASH = await hashPassword('timing-equaliser');
const INVALID_LOGIN = 'Invalid username or password';

export type NewKeys = Omit<KeyBundle, 'recoveryVerifierHash'> & { recoveryVerifier: string };

const toKeyBundle = ({ recoveryVerifier, ...keys }: NewKeys): KeyBundle => ({
  ...keys,
  recoveryVerifierHash: sha256Hex(recoveryVerifier),
});

/** Returns what a browser needs to derive its login key. Unknown names get a stable decoy salt. */
export async function prelogin(username: string): Promise<{ salt: string; legacy: boolean }> {
  const user = await findUserByUsername(username);
  if (!user) return { salt: decoySalt(username), legacy: false };
  return user.kdfSalt ? { salt: user.kdfSalt, legacy: false } : { salt: '', legacy: true };
}

/** Creates an account and joins the server its code belongs to. */
export async function register(
  username: string,
  authKey: string,
  keys: NewKeys,
  inviteCode: string,
): Promise<AuthUser> {
  const resolved = await requireCode(inviteCode);

  let id: number;
  try {
    id = await insertUser(username, await hashPassword(authKey), toKeyBundle(keys));
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That username is taken');
    throw err;
  }
  try {
    await applyCode(resolved, id);
  } catch (err) {
    await deleteUser(id);
    throw err;
  }
  return { id, username };
}

/** Checks a login, spending equal time whether or not the user exists. */
async function assertSecret(user: UserRecord | null, secret: string): Promise<UserRecord> {
  const valid = await verifyPassword(secret, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, INVALID_LOGIN);
  return user;
}

/** Signs in with a login key. Old accounts send their password once, then upgrade. */
export async function login(username: string, secret: { authKey: string } | { password: string }): Promise<UserRecord> {
  const user = await findUserByUsername(username);
  const isLegacy = !!user && !user.kdfSalt;
  if ('password' in secret !== isLegacy) {
    await verifyPassword('', DUMMY_HASH);
    throw new HttpError(401, INVALID_LOGIN);
  }
  return assertSecret(user, 'password' in secret ? secret.password : secret.authKey);
}

/** Gives an old account its keys, after which the server never sees its password again. */
export async function upgradeAccount(userId: number, authKey: string, keys: NewKeys): Promise<void> {
  await saveUserKeys(userId, await hashPassword(authKey), toKeyBundle(keys));
}

const assertRecoveryVerifier = (user: UserRecord | null, verifier: string): UserRecord => {
  if (!user || user.recoveryVerifierHash !== sha256Hex(verifier)) {
    throw new HttpError(401, 'That username and recovery key do not match');
  }
  return user;
};

/** Returns the private key copy protected by the recovery key. */
export async function getRecoveryKey(username: string, verifier: string): Promise<string> {
  const user = assertRecoveryVerifier(await findUserByUsername(username), verifier);
  return user.recoveryWrappedPrivateKey as string;
}

/** Sets a new password after proving knowledge of the recovery key. */
export async function recover(
  username: string,
  verifier: string,
  authKey: string,
  kdfSalt: string,
  wrappedPrivateKey: string,
): Promise<UserRecord> {
  const user = assertRecoveryVerifier(await findUserByUsername(username), verifier);
  await updateLogin(user.id, await hashPassword(authKey), kdfSalt, wrappedPrivateKey);
  return user;
}

