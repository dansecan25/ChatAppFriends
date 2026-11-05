import { pool } from '../connections/mariadb.js';
import { getMongoDb } from '../connections/mongodb.js';

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/** Tables that are new since the first release, shared by a fresh install and the migration. */
export async function createSecurityTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS servers (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slot INT UNSIGNED NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      root_key_version INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_members (
      server_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      nickname_enc TEXT NULL,
      PRIMARY KEY (server_id, user_id),
      KEY server_members_user (user_id),
      FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_keys (
      server_id INT UNSIGNED NOT NULL,
      version INT UNSIGNED NOT NULL,
      key_enc TEXT NOT NULL,
      PRIMARY KEY (server_id, version),
      FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS revoked_codes (
      code_hash CHAR(64) PRIMARY KEY,
      revoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      server_id INT UNSIGNED NOT NULL,
      name VARCHAR(32) NOT NULL,
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY roles_name (server_id, name),
      FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_roles (
      role_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (role_id, user_id),
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_roles (
      channel_id INT UNSIGNED NOT NULL,
      role_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (channel_id, role_id),
      FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_keys (
      channel_id INT UNSIGNED NOT NULL,
      version INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      wrapped_key TEXT NOT NULL,
      PRIMARY KEY (channel_id, version, user_id),
      FOREIGN KEY (channel_id) REFERENCES channels (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_low INT UNSIGNED NOT NULL,
      user_high INT UNSIGNED NOT NULL,
      wrapped_key_low TEXT NOT NULL,
      wrapped_key_high TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY dm_pair (user_low, user_high),
      FOREIGN KEY (user_low) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (user_high) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
}

/** Creates the Mongo indexes when missing. */
export async function ensureMessageIndexes(): Promise<void> {
  const messages = getMongoDb().collection('messages');
  await messages.createIndex({ channelId: 1, _id: -1 });
  await messages.createIndex({ dmId: 1, _id: -1 }, { sparse: true });
  await messages.createIndex({ 'image.id': 1 }, { sparse: true });
  await messages.createIndex({ 'attachment.id': 1 }, { sparse: true });
}

export const hasColumn = async (table: string, column: string): Promise<boolean> => {
  const rows = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
};

/** Tells whether the database is missing part of the current schema. */
export const needsMigration = async (): Promise<boolean> =>
  (await hasColumn('users', 'username')) || !(await hasColumn('servers', 'slot')) || !(await hasColumn('users', 'avatar_id'));

/** Creates all tables on an empty database, and refuses to start on an unmigrated one. */
export async function ensureSchema(): Promise<void> {
  const tables = await pool.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
  );
  if (tables.length > 0 && (await needsMigration())) {
    throw new Error('This database uses the old schema. Back it up, then run: npm run migrate -w server');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username_hash CHAR(64) NOT NULL UNIQUE,
      username_enc TEXT NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      kdf_salt VARCHAR(64) NULL,
      public_key TEXT NULL,
      wrapped_private_key TEXT NULL,
      recovery_wrapped_private_key TEXT NULL,
      recovery_verifier_hash CHAR(64) NULL,
      is_owner TINYINT(1) NOT NULL DEFAULT 0,
      avatar_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ${TABLE_OPTIONS}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      server_id INT UNSIGNED NOT NULL,
      name VARCHAR(50) NOT NULL,
      type ENUM('text', 'voice') NOT NULL,
      restricted TINYINT(1) NOT NULL DEFAULT 0,
      key_version INT UNSIGNED NOT NULL DEFAULT 0,
      rotation_pending TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY channels_name_type (server_id, name, type),
      CONSTRAINT channels_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ${TABLE_OPTIONS}`);
  await createSecurityTables();
  await pool.query(`
    ALTER TABLE channels ADD CONSTRAINT channels_server
      FOREIGN KEY IF NOT EXISTS (server_id) REFERENCES servers (id) ON DELETE CASCADE`);
  await ensureMessageIndexes();
}
