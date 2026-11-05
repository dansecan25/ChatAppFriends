import { pool } from '../connections/mariadb.js';

export type ChannelType = 'text' | 'voice';

export interface Channel {
  id: number;
  serverId: number;
  name: string;
  type: ChannelType;
  restricted: boolean;
  keyVersion: number;
  rotationPending: boolean;
  createdBy: number | null;
  roleIds: number[];
}

export interface KeyEnvelope {
  version: number;
  userId: number;
  wrappedKey: string;
}

const SELECT_CHANNEL = `
  SELECT c.id, c.server_id AS serverId, c.name, c.type, c.restricted, c.key_version AS keyVersion,
    c.rotation_pending AS rotationPending, c.created_by AS createdBy,
    (SELECT GROUP_CONCAT(cr.role_id) FROM channel_roles cr WHERE cr.channel_id = c.id) AS roleIds
  FROM channels c`;

const toChannel = (row: any): Channel => ({
  ...row,
  restricted: Boolean(row.restricted),
  rotationPending: Boolean(row.rotationPending),
  roleIds: row.roleIds ? String(row.roleIds).split(',').map(Number) : [],
});

/** Lists a server's channels in creation order. */
export async function listChannels(serverId: number): Promise<Channel[]> {
  return (await pool.query(`${SELECT_CHANNEL} WHERE c.server_id = ? ORDER BY c.id`, [serverId])).map(toChannel);
}

/** Finds a channel by id. */
export async function findChannelById(id: number): Promise<Channel | null> {
  const rows = await pool.query(`${SELECT_CHANNEL} WHERE c.id = ?`, [id]);
  return rows[0] ? toChannel(rows[0]) : null;
}

/** Inserts a channel with its roles and returns it. */
export async function insertChannel(
  serverId: number,
  name: string,
  type: ChannelType,
  createdBy: number | null,
  roleIds: number[] = [],
): Promise<Channel> {
  const result = await pool.query(
    'INSERT INTO channels (server_id, name, type, restricted, created_by) VALUES (?, ?, ?, ?, ?)',
    [serverId, name, type, roleIds.length > 0, createdBy],
  );
  await setChannelRoles(result.insertId, roleIds);
  return {
    id: result.insertId,
    serverId,
    name,
    type,
    restricted: roleIds.length > 0,
    keyVersion: 0,
    rotationPending: false,
    createdBy,
    roleIds,
  };
}

/** Renames a channel. */
export async function renameChannelById(id: number, name: string): Promise<void> {
  await pool.query('UPDATE channels SET name = ? WHERE id = ?', [name, id]);
}

/** Replaces the roles allowed in a channel. */
export async function setChannelRoles(channelId: number, roleIds: number[]): Promise<void> {
  await pool.query('DELETE FROM channel_roles WHERE channel_id = ?', [channelId]);
  for (const roleId of roleIds) {
    await pool.query('INSERT INTO channel_roles (channel_id, role_id) VALUES (?, ?)', [channelId, roleId]);
  }
}

/** Deletes a channel by id. */
export async function deleteChannelById(id: number): Promise<void> {
  await pool.query('DELETE FROM channels WHERE id = ?', [id]);
}

/** Flags channels whose key must change because someone lost access. */
export async function flagRotation(channelIds: number[]): Promise<void> {
  if (channelIds.length === 0) return;
  await pool.query(`UPDATE channels SET rotation_pending = 1 WHERE id IN (${channelIds.map(() => '?').join()})`, channelIds);
}

/** Moves a channel to a new key version, unless someone else already did. */
export async function advanceKeyVersion(channelId: number, version: number): Promise<boolean> {
  const result = await pool.query(
    'UPDATE channels SET key_version = ?, rotation_pending = 0 WHERE id = ? AND key_version = ?',
    [version, channelId, version - 1],
  );
  return result.affectedRows === 1;
}

/** Stores copies of a channel's keys, keeping any that already exist. */
export async function insertKeyEnvelopes(channelId: number, envelopes: KeyEnvelope[]): Promise<void> {
  for (const { version, userId, wrappedKey } of envelopes) {
    await pool.query(
      'INSERT IGNORE INTO channel_keys (channel_id, version, user_id, wrapped_key) VALUES (?, ?, ?, ?)',
      [channelId, version, userId, wrappedKey],
    );
  }
}

/** Returns every copy of a channel's keys held for a user. */
export async function listKeyEnvelopes(channelId: number, userId: number): Promise<KeyEnvelope[]> {
  return pool.query(
    `SELECT version, user_id AS userId, wrapped_key AS wrappedKey
     FROM channel_keys WHERE channel_id = ? AND user_id = ? ORDER BY version`,
    [channelId, userId],
  );
}

/** Returns which key versions each user has for a channel. */
export async function listKeyHolders(channelId: number): Promise<{ version: number; userId: number }[]> {
  return pool.query('SELECT version, user_id AS userId FROM channel_keys WHERE channel_id = ?', [channelId]);
}
