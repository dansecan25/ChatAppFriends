import { pool } from '../connections/mariadb.js';

export interface DmConversation {
  id: number;
  userLow: number;
  userHigh: number;
  wrappedKeyLow: string;
  wrappedKeyHigh: string;
}

const SELECT_DM = `
  SELECT id, user_low AS userLow, user_high AS userHigh, wrapped_key_low AS wrappedKeyLow,
    wrapped_key_high AS wrappedKeyHigh
  FROM dm_conversations`;

/** Lists a user's conversations. */
export async function listDmsForUser(userId: number): Promise<DmConversation[]> {
  return pool.query(`${SELECT_DM} WHERE user_low = ? OR user_high = ? ORDER BY id`, [userId, userId]);
}

/** Finds a conversation by id. */
export async function findDmById(id: number): Promise<DmConversation | null> {
  const rows = await pool.query(`${SELECT_DM} WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

/** Finds the conversation between two users. */
export async function findDmByPair(userLow: number, userHigh: number): Promise<DmConversation | null> {
  const rows = await pool.query(`${SELECT_DM} WHERE user_low = ? AND user_high = ?`, [userLow, userHigh]);
  return rows[0] ?? null;
}

/** Creates a conversation, returning its id. */
export async function insertDm(
  userLow: number,
  userHigh: number,
  wrappedKeyLow: string,
  wrappedKeyHigh: string,
): Promise<number> {
  const result = await pool.query(
    'INSERT INTO dm_conversations (user_low, user_high, wrapped_key_low, wrapped_key_high) VALUES (?, ?, ?, ?)',
    [userLow, userHigh, wrappedKeyLow, wrappedKeyHigh],
  );
  return result.insertId;
}

/** Tells whether two users share any server. */
export async function shareServer(userA: number, userB: number): Promise<boolean> {
  const rows = await pool.query(
    `SELECT 1 FROM server_members a JOIN server_members b ON a.server_id = b.server_id
     WHERE a.user_id = ? AND b.user_id = ? LIMIT 1`,
    [userA, userB],
  );
  return rows.length > 0;
}
