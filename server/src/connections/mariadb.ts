import mariadb from 'mariadb';
import { config } from '../config.js';

export const pool = mariadb.createPool({
  host: config.MARIADB_HOST,
  port: config.MARIADB_PORT,
  user: config.MARIADB_USER,
  password: config.MARIADB_PASSWORD,
  database: config.MARIADB_DATABASE,
  connectionLimit: 5,
  charset: 'utf8mb4',
  insertIdAsNumber: true,
  bigIntAsNumber: true,
});

/** Verifies that MariaDB is reachable. */
export async function connectMariadb(): Promise<void> {
  await pool.query('SELECT 1');
}
