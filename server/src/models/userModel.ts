import { pool } from '../connections/mariadb.js';
import { decryptField, encryptField, usernameLookupHash } from '../utils/fieldCrypto.js';

export interface AuthUser {
  id: number;
  username: string;
}

export interface KeyBundle {
  kdfSalt: string;
  publicKey: string;
  wrappedPrivateKey: string;
  recoveryWrappedPrivateKey: string;
  recoveryVerifierHash: string;
}

export interface UserRecord extends AuthUser {
  passwordHash: string;
  isOwner: boolean;
  kdfSalt: string | null;
  publicKey: string | null;
  wrappedPrivateKey: string | null;
  recoveryWrappedPrivateKey: string | null;
  recoveryVerifierHash: string | null;
}

const SELECT_USER = `
  SELECT id, username_enc AS usernameEnc, password_hash AS passwordHash, is_owner AS isOwner, kdf_salt AS kdfSalt,
    public_key AS publicKey, wrapped_private_key AS wrappedPrivateKey,
    recovery_wrapped_private_key AS recoveryWrappedPrivateKey, recovery_verifier_hash AS recoveryVerifierHash
  FROM users`;

const toRecord = ({ usernameEnc, isOwner, ...row }: any): UserRecord => ({
  ...row,
  username: decryptField(usernameEnc),
  isOwner: Boolean(isOwner),
});

/** Finds a user by username. */
export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const rows = await pool.query(`${SELECT_USER} WHERE username_hash = ?`, [usernameLookupHash(username)]);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** Finds a user by id. */
export async function findUserById(id: number): Promise<UserRecord | null> {
  const rows = await pool.query(`${SELECT_USER} WHERE id = ?`, [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** Finds several users at once, keyed by id. */
export async function findUsersByIds(ids: number[]): Promise<Map<number, UserRecord>> {
  if (ids.length === 0) return new Map();
  const rows = await pool.query(`${SELECT_USER} WHERE id IN (${ids.map(() => '?').join()})`, ids);
  return new Map(rows.map((row: any) => [row.id, toRecord(row)]));
}

/** Inserts a user and returns the new id. */
export async function insertUser(username: string, passwordHash: string, keys: KeyBundle): Promise<number> {
  const result = await pool.query(
    `INSERT INTO users (username_hash, username_enc, password_hash, kdf_salt, public_key, wrapped_private_key,
       recovery_wrapped_private_key, recovery_verifier_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usernameLookupHash(username),
      encryptField(username),
      passwordHash,
      keys.kdfSalt,
      keys.publicKey,
      keys.wrappedPrivateKey,
      keys.recoveryWrappedPrivateKey,
      keys.recoveryVerifierHash,
    ],
  );
  return result.insertId;
}

/** Deletes a user, used when a signup cannot be completed. */
export async function deleteUser(id: number): Promise<void> {
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
}

/** Saves an account's keys and login key, for accounts created before encryption. */
export async function saveUserKeys(id: number, passwordHash: string, keys: KeyBundle): Promise<void> {
  await pool.query(
    `UPDATE users SET password_hash = ?, kdf_salt = ?, public_key = ?, wrapped_private_key = ?,
       recovery_wrapped_private_key = ?, recovery_verifier_hash = ? WHERE id = ? AND kdf_salt IS NULL`,
    [
      passwordHash,
      keys.kdfSalt,
      keys.publicKey,
      keys.wrappedPrivateKey,
      keys.recoveryWrappedPrivateKey,
      keys.recoveryVerifierHash,
      id,
    ],
  );
}

/** Replaces the login after an account recovery. The key pair stays the same. */
export async function updateLogin(
  id: number,
  passwordHash: string,
  kdfSalt: string,
  wrappedPrivateKey: string,
): Promise<void> {
  await pool.query('UPDATE users SET password_hash = ?, kdf_salt = ?, wrapped_private_key = ? WHERE id = ?', [
    passwordHash,
    kdfSalt,
    wrappedPrivateKey,
    id,
  ]);
}

/** Returns the owner's id, if the owner has signed up. */
export async function findOwnerId(): Promise<number | null> {
  const rows: { id: number }[] = await pool.query('SELECT id FROM users WHERE is_owner = 1 LIMIT 1');
  return rows[0]?.id ?? null;
}

/** Makes a user the owner, unless the app already has one. Returns whether it worked. */
export async function claimOwnership(id: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE users SET is_owner = 1 WHERE id = ? AND NOT EXISTS (
       SELECT 1 FROM (SELECT id FROM users WHERE is_owner = 1) AS owners)`,
    [id],
  );
  return result.affectedRows === 1;
}
