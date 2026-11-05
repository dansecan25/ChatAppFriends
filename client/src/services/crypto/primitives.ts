const encoder = new TextEncoder();
const decoder = new TextDecoder();
const AES_KEY_BYTES = 32;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 600_000;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;

/** WebCrypto's types require buffers backed by a plain ArrayBuffer. */
export type Bytes = Uint8Array<ArrayBuffer>;

export const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
export const fromBase64 = (text: string): Bytes => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const toHex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const randomBytes = (length: number): Bytes => crypto.getRandomValues(new Uint8Array(length));
export const newSymmetricKey = (): Bytes => randomBytes(AES_KEY_BYTES);
const sha256 = async (text: string): Promise<Bytes> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export const sha256Hex = async (text: string): Promise<string> => toHex(await sha256(text));

/** Imports raw bytes as an AES-GCM key. */
export const toAesKey = (raw: Bytes): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

/** Builds AES-GCM parameters. Chrome rejects an explicit undefined, so the context is only set when there is one. */
const gcmParams = (iv: Bytes, aad?: string): AesGcmParams =>
  aad === undefined ? { name: 'AES-GCM', iv } : { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) };

/** Encrypts bytes into a single base64 string that carries its own IV. */
export async function sealBytes(key: CryptoKey, plain: Bytes, aad?: string): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const sealed = await crypto.subtle.encrypt(gcmParams(iv, aad), key, plain);
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return toBase64(out);
}

/** Opens a string written by sealBytes. Throws when the data or its context was changed. */
export async function openBytes(key: CryptoKey, sealed: string, aad?: string): Promise<Bytes> {
  const data = fromBase64(sealed);
  const plain = await crypto.subtle.decrypt(gcmParams(data.slice(0, IV_BYTES), aad), key, data.subarray(IV_BYTES));
  return new Uint8Array(plain);
}

export const sealText = (key: CryptoKey, text: string, aad?: string): Promise<string> =>
  sealBytes(key, encoder.encode(text), aad);
export const openText = async (key: CryptoKey, sealed: string, aad?: string): Promise<string> =>
  decoder.decode(await openBytes(key, sealed, aad));

/** Derives a one-purpose key from a longer-lived secret. */
export async function deriveSubkey(secret: Bytes, info: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Splits a password into a login key the server sees and a key it never sees. */
export async function deriveFromPassword(password: string, saltBase64: string) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltBase64), iterations: PBKDF2_ITERATIONS },
      base,
      512,
    ),
  );
  return { authKey: toHex(bits.subarray(0, 32)), wrappingKey: await toAesKey(bits.slice(32)) };
}

export interface GeneratedKeyPair {
  publicKey: string;
  privateKeyBytes: Bytes;
}

/** Generates an account's key pair, exportable once so it can be protected for storage. */
export async function generateKeyPair(): Promise<GeneratedKeyPair> {
  const pair = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  return {
    publicKey: toBase64(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))),
    privateKeyBytes: new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)),
  };
}

/** Imports a private key so that scripts on the page can use it but never read it. */
export const importPrivateKey = (bytes: Bytes): Promise<CryptoKey> =>
  crypto.subtle.importKey('pkcs8', bytes, ECDH, false, ['deriveBits']);

const importPublicKey = (publicKey: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('spki', fromBase64(publicKey), ECDH, true, []);

const sharedWrappingKey = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> => {
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  return deriveSubkey(new Uint8Array(secret), 'wrap-for-user');
};

/** Encrypts a key so only the holder of a private key can open it. */
export async function wrapForUser(raw: Bytes, recipientPublicKey: string): Promise<string> {
  const ephemeral = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const key = await sharedWrappingKey(ephemeral.privateKey, await importPublicKey(recipientPublicKey));
  const ephemeralPublic = toBase64(new Uint8Array(await crypto.subtle.exportKey('spki', ephemeral.publicKey)));
  return `${ephemeralPublic}.${await sealBytes(key, raw, recipientPublicKey)}`;
}

/** Opens a key encrypted by wrapForUser. */
export async function unwrapFromUser(wrapped: string, privateKey: CryptoKey, ownPublicKey: string): Promise<Bytes> {
  const [ephemeralPublic, sealed] = wrapped.split('.');
  const key = await sharedWrappingKey(privateKey, await importPublicKey(ephemeralPublic));
  return openBytes(key, sealed, ownPublicKey);
}

/** Hashes a recovery key into what the server checks, which can't be turned back into the key. */
export const codeVerifier = (code: string): Promise<string> => sha256Hex(`chatapp-recovery-verifier:${code}`);

/** Derives the key a recovery key protects. The server never sees the recovery key, so it can't derive this. */
export const codeWrappingKey = async (code: string): Promise<CryptoKey> => toAesKey(await sha256(`chatapp-recovery-wrap:${code}`));

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a readable secret code, such as an invite or recovery key. */
export function generateCode(length: number): string {
  const characters = [...randomBytes(length)].map((byte) => BASE32[byte % BASE32.length]);
  return characters.join('').replace(/(.{4})(?=.)/g, '$1-');
}

/** Returns a number two people can compare to confirm no one swapped their keys. */
export async function safetyNumber(publicKeyA: string, publicKeyB: string): Promise<string> {
  const digest = await sha256([publicKeyA, publicKeyB].sort().join('|'));
  const digits = [...digest.subarray(0, 12)].map((byte) => String(byte % 100).padStart(2, '0')).join('');
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
}
