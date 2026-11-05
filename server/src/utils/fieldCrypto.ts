import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const key = Buffer.from(config.DATA_ENCRYPTION_KEY, 'hex');
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Encrypts a database field with the server's key. */
export function encryptField(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

/** Decrypts a field written by encryptField. */
export function decryptField(stored: string): string {
  const data = Buffer.from(stored, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, IV_BYTES));
  decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}

/** Returns a keyed hash that finds a username without storing it readably; names differing only by case match. */
export function usernameLookupHash(username: string): string {
  return createHmac('sha256', key).update(`lookup:${username.normalize('NFKC').toLowerCase()}`).digest('hex');
}

/** Returns a stable salt for an unknown username, so a login attempt cannot reveal who has an account. */
export function decoySalt(username: string): string {
  return createHmac('sha256', key).update(`salt:${username.normalize('NFKC').toLowerCase()}`).digest('base64').slice(0, 24);
}

/** Hashes a high-entropy secret such as an invite verifier. */
export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');
