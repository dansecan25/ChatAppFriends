import { pool } from '../connections/mariadb.js';

export interface Server {
  id: number;
  slot: number;
  name: string;
  rootKeyVersion: number;
}

export interface StoredRootKey {
  version: number;
  keyEnc: string;
}

const ADMIN_ROLE_NAME = 'Admin';
const SELECT_SERVER = 'SELECT s.id, s.slot, s.name, s.root_key_version AS rootKeyVersion FROM servers s';

/** Creates a server with its built-in admin role, returning the server's id. */
export async function insertServer(slot: number, name: string): Promise<number> {
  const result = await pool.query('INSERT INTO servers (slot, name) VALUES (?, ?)', [slot, name]);
  await pool.query('INSERT INTO roles (server_id, name, is_admin) VALUES (?, ?, 1)', [result.insertId, ADMIN_ROLE_NAME]);
  return result.insertId;
}

/** Finds the server assigned to a position in the invite code list. */
export async function findServerBySlot(slot: number): Promise<Server | null> {
  const rows = await pool.query(`${SELECT_SERVER} WHERE s.slot = ?`, [slot]);
  return rows[0] ?? null;
}

/** Finds a server by id. */
export async function findServerById(id: number): Promise<Server | null> {
  const rows = await pool.query(`${SELECT_SERVER} WHERE s.id = ?`, [id]);
  return rows[0] ?? null;
}

/** Lists the servers a user belongs to. */
export async function listServersForUser(userId: number): Promise<Server[]> {
  return pool.query(
    `${SELECT_SERVER} JOIN server_members m ON m.server_id = s.id WHERE m.user_id = ? ORDER BY s.slot`,
    [userId],
  );
}

/** Lists the ids of every server. */
export async function listAllServerIds(): Promise<number[]> {
  const rows: { id: number }[] = await pool.query('SELECT id FROM servers');
  return rows.map((row) => row.id);
}

/** Renames a server. */
export async function renameServer(id: number, name: string): Promise<void> {
  await pool.query('UPDATE servers SET name = ? WHERE id = ?', [name, id]);
}

/** Returns every stored version of a server's key. */
export async function listRootKeys(serverId: number): Promise<StoredRootKey[]> {
  return pool.query('SELECT version, key_enc AS keyEnc FROM server_keys WHERE server_id = ? ORDER BY version', [serverId]);
}

/** Stores a version of a server's key and makes it the current one. */
export async function insertRootKey(serverId: number, version: number, keyEnc: string): Promise<void> {
  await pool.query('INSERT INTO server_keys (server_id, version, key_enc) VALUES (?, ?, ?)', [serverId, version, keyEnc]);
  await pool.query('UPDATE servers SET root_key_version = ? WHERE id = ?', [version, serverId]);
}

/** Tells whether a user belongs to a server. */
export async function isMember(serverId: number, userId: number): Promise<boolean> {
  const rows = await pool.query('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?', [serverId, userId]);
  return rows.length > 0;
}

/** Lists the ids of a server's members. */
export async function listMemberIds(serverId: number): Promise<number[]> {
  const rows: { userId: number }[] = await pool.query(
    'SELECT user_id AS userId FROM server_members WHERE server_id = ?',
    [serverId],
  );
  return rows.map((row) => row.userId);
}

/** Adds a member unless the server is full. Returns whether the member was added. */
export async function insertMemberWithinLimit(serverId: number, userId: number, maxMembers: number): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO server_members (server_id, user_id)
     SELECT ?, ? FROM DUAL WHERE (SELECT COUNT(*) FROM server_members WHERE server_id = ?) < ?`,
    [serverId, userId, serverId, maxMembers],
  );
  return result.affectedRows === 1;
}

/** Adds the owner to a server, ignoring the member limit. */
export async function insertOwnerMembership(serverId: number, userId: number): Promise<void> {
  await pool.query('INSERT IGNORE INTO server_members (server_id, user_id) VALUES (?, ?)', [serverId, userId]);
}

/** Removes a member with their roles and restricted channel keys. Past messages keep their author. */
export async function deleteMember(serverId: number, userId: number): Promise<void> {
  await pool.query(
    'DELETE mr FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE r.server_id = ? AND mr.user_id = ?',
    [serverId, userId],
  );
  await pool.query(
    'DELETE ck FROM channel_keys ck JOIN channels c ON c.id = ck.channel_id WHERE c.server_id = ? AND ck.user_id = ?',
    [serverId, userId],
  );
  await pool.query('DELETE FROM server_members WHERE server_id = ? AND user_id = ?', [serverId, userId]);
}

/** Adds a code's hash to the blacklist. */
export async function insertRevokedCode(codeHash: string): Promise<void> {
  await pool.query('INSERT IGNORE INTO revoked_codes (code_hash) VALUES (?)', [codeHash]);
}

/** Tells whether a code is on the blacklist. */
export async function isCodeRevoked(codeHash: string): Promise<boolean> {
  return (await pool.query('SELECT 1 FROM revoked_codes WHERE code_hash = ?', [codeHash])).length > 0;
}
