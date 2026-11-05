import { pool } from '../connections/mariadb.js';

export type ChannelType = 'text' | 'voice';

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  createdBy: number | null;
}

const SELECT_CHANNEL = 'SELECT id, name, type, created_by AS createdBy FROM channels';

/** Lists every channel in creation order. */
export async function listChannels(): Promise<Channel[]> {
  return pool.query(`${SELECT_CHANNEL} ORDER BY id`);
}

/** Finds a channel by id. */
export async function findChannelById(id: number): Promise<Channel | null> {
  const rows = await pool.query(`${SELECT_CHANNEL} WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

/** Inserts a channel and returns it. */
export async function insertChannel(name: string, type: ChannelType, createdBy: number | null): Promise<Channel> {
  const result = await pool.query('INSERT INTO channels (name, type, created_by) VALUES (?, ?, ?)', [
    name,
    type,
    createdBy,
  ]);
  return { id: result.insertId, name, type, createdBy };
}

/** Deletes a channel by id. */
export async function deleteChannelById(id: number): Promise<void> {
  await pool.query('DELETE FROM channels WHERE id = ?', [id]);
}
