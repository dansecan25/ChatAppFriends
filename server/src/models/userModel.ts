import { pool } from '../connections/mariadb.js';

export interface AuthUser {
  id: number;
  username: string;
}

export interface UserRecord extends AuthUser {
  passwordHash: string;
}

/** Finds a user with their password hash by username. */
export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const rows = await pool.query(
    'SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?',
    [username],
  );
  return rows[0] ?? null;
}

/** Finds a user by id. */
export async function findUserById(id: number): Promise<AuthUser | null> {
  const rows = await pool.query('SELECT id, username FROM users WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/** Inserts a user unless the limit is reached, returning the new id or null when full. */
export async function insertUserWithinLimit(
  username: string,
  passwordHash: string,
  maxUsers: number,
): Promise<number | null> {
  const result = await pool.query(
    `INSERT INTO users (username, password_hash)
     SELECT ?, ? FROM DUAL WHERE (SELECT COUNT(*) FROM users) < ?`,
    [username, passwordHash, maxUsers],
  );
  return result.affectedRows === 1 ? result.insertId : null;
}
