import { importPrivateKey, openBytes, sealBytes, toBase64, generateCode, generateKeyPair, randomBytes, codeVerifier, codeWrappingKey, deriveFromPassword } from './primitives';

const DB_NAME = 'chatapp-keys';
const IDENTITY_STORE = 'identity';
const PIN_STORE = 'pins';
const SALT_BYTES = 16;
const RECOVERY_CODE_LENGTH = 32;

export interface Identity {
  userId: number;
  publicKey: string;
  privateKey: CryptoKey;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDENTITY_STORE);
      request.result.createObjectStore(PIN_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(store, mode).objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

let current: Identity | null = null;

/** Returns this browser's unlocked identity for a user, or null when they must sign in again. */
export async function loadIdentity(userId: number): Promise<Identity | null> {
  if (current?.userId === userId) return current;
  current = (await withStore<Identity | undefined>(IDENTITY_STORE, 'readonly', (s) => s.get(userId))) ?? null;
  return current;
}

/** Returns the unlocked identity, which exists for any signed-in page. */
export function requireIdentity(): Identity {
  if (!current) throw new Error('Your keys are locked. Please sign in again.');
  return current;
}

/** Keeps a private key on this device, in a form scripts can use but not read. */
export async function saveIdentity(identity: Identity): Promise<void> {
  await withStore(IDENTITY_STORE, 'readwrite', (s) => s.put(identity, identity.userId));
  current = identity;
}

/** Forgets the private key on this device. */
export async function clearIdentity(): Promise<void> {
  if (current) await withStore(IDENTITY_STORE, 'readwrite', (s) => s.delete((current as Identity).userId));
  current = null;
}

/** Remembers a person's key the first time it's seen, and refuses a different one later. */
export async function assertPinnedKey(otherUserId: number, username: string, publicKey: string): Promise<void> {
  const id = `${requireIdentity().userId}:${otherUserId}`;
  const pinned = await withStore<string | undefined>(PIN_STORE, 'readonly', (s) => s.get(id));
  if (pinned && pinned !== publicKey) {
    throw new Error(`${username}'s security key changed, so nothing was shared with them. Check with them directly.`);
  }
  if (!pinned) await withStore(PIN_STORE, 'readwrite', (s) => s.put(publicKey, id));
}

/** Creates everything a new account stores: a login key, protected key pair and recovery key. */
export async function createAccountKeys(password: string) {
  const kdfSalt = toBase64(randomBytes(SALT_BYTES));
  const { authKey, wrappingKey } = await deriveFromPassword(password, kdfSalt);
  const { publicKey, privateKeyBytes } = await generateKeyPair();
  const recoveryCode = generateCode(RECOVERY_CODE_LENGTH);
  const keys = {
    kdfSalt,
    publicKey,
    wrappedPrivateKey: await sealBytes(wrappingKey, privateKeyBytes),
    recoveryWrappedPrivateKey: await sealBytes(await codeWrappingKey(recoveryCode), privateKeyBytes),
    recoveryVerifier: await codeVerifier(recoveryCode),
  };
  return { authKey, keys, recoveryCode, publicKey, privateKey: await importPrivateKey(privateKeyBytes) };
}

/** Unlocks an account's private key with the key derived from its password. */
export async function unlockPrivateKey(wrappingKey: CryptoKey, wrappedPrivateKey: string): Promise<CryptoKey> {
  return importPrivateKey(await openBytes(wrappingKey, wrappedPrivateKey));
}

/** Re-protects a private key under a new password, using the recovery key. */
export async function rewrapWithRecovery(recoveryCode: string, recoveryWrappedKey: string, newPassword: string) {
  const privateKeyBytes = await openBytes(await codeWrappingKey(recoveryCode), recoveryWrappedKey);
  const kdfSalt = toBase64(randomBytes(SALT_BYTES));
  const { authKey, wrappingKey } = await deriveFromPassword(newPassword, kdfSalt);
  return {
    authKey,
    kdfSalt,
    wrappedPrivateKey: await sealBytes(wrappingKey, privateKeyBytes),
    privateKey: await importPrivateKey(privateKeyBytes),
  };
}
