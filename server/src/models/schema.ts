import { pool } from '../connections/mariadb.js';
import { getMongoDb } from '../connections/mongodb.js';

/** Creates the SQL tables and MongoDB indexes when missing. */
export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(32) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      type ENUM('text', 'voice') NOT NULL,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY channels_name_type (name, type),
      CONSTRAINT channels_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const messages = getMongoDb().collection('messages');
  await messages.createIndex({ channelId: 1, _id: -1 });
  await messages.createIndex({ 'image.id': 1 }, { sparse: true });
}
