import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { SERVER_DEFINITIONS } from '../serverDefinitions.js';
import { pool } from '../connections/mariadb.js';
import { closeMongodb, connectMongodb, getMongoDb } from '../connections/mongodb.js';
import { encryptField, usernameLookupHash } from '../utils/fieldCrypto.js';
import { ADMINISTRATOR } from '../utils/permissions.js';
import {
  createSecurityTables,
  ensureMessageIndexes,
  EVERYONE_PERMISSIONS_COLUMN,
  hasColumn,
  needsMigration,
  ROLE_PERMISSIONS_COLUMN,
} from './schema.js';
import { insertServer } from './serverModel.js';

/** Moves users to encrypted usernames and login keys. Passwords keep working until each user next signs in. */
async function migrateUsers(): Promise<void> {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username_hash CHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS username_enc TEXT NULL,
      ADD COLUMN IF NOT EXISTS kdf_salt VARCHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS public_key TEXT NULL,
      ADD COLUMN IF NOT EXISTS wrapped_private_key TEXT NULL,
      ADD COLUMN IF NOT EXISTS recovery_wrapped_private_key TEXT NULL,
      ADD COLUMN IF NOT EXISTS recovery_verifier_hash CHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS is_owner TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(64) NULL`);
  const users: { id: number; username: string }[] = await pool.query('SELECT id, username FROM users');
  for (const user of users) {
    await pool.query('UPDATE users SET username_hash = ?, username_enc = ? WHERE id = ?', [
      usernameLookupHash(user.username),
      encryptField(user.username),
      user.id,
    ]);
  }
  await pool.query(`
    ALTER TABLE users
      MODIFY username_hash CHAR(64) NOT NULL,
      MODIFY username_enc TEXT NOT NULL,
      ADD UNIQUE KEY users_username_hash (username_hash),
      DROP COLUMN username`);
}

/** Attaches every existing channel to the first server in the list. */
async function migrateChannels(): Promise<void> {
  const serverId = await insertServer(0, SERVER_DEFINITIONS[0].name);
  await pool.query(`
    ALTER TABLE channels
      ADD COLUMN IF NOT EXISTS server_id INT UNSIGNED NULL AFTER id,
      ADD COLUMN IF NOT EXISTS restricted TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS key_version INT UNSIGNED NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rotation_pending TINYINT(1) NOT NULL DEFAULT 0`);
  await pool.query('UPDATE channels SET server_id = ? WHERE server_id IS NULL', [serverId]);
  await pool.query(`
    ALTER TABLE channels
      MODIFY server_id INT UNSIGNED NOT NULL,
      DROP INDEX channels_name_type,
      ADD UNIQUE KEY channels_name_type (server_id, name, type),
      ADD CONSTRAINT channels_server FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE`);
}

/** Adds role permissions. The Admin role gets every permission, and everyone keeps what they could already do. */
async function migratePermissions(): Promise<void> {
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS ${ROLE_PERMISSIONS_COLUMN}`);
  await pool.query(`ALTER TABLE servers ADD COLUMN IF NOT EXISTS ${EVERYONE_PERMISSIONS_COLUMN}`);
  await pool.query('UPDATE roles SET permissions = permissions | ? WHERE is_admin = 1', [ADMINISTRATOR]);
}

/** Removes readable usernames from old messages; the app looks authors up by id. */
async function migrateMessages(): Promise<void> {
  await getMongoDb().collection('messages').updateMany({}, { $unset: { authorUsername: '' } });
}

/** Permanently deletes messages and images from before encryption. Only runs when asked for. */
async function purgeOldMessages(): Promise<void> {
  const messages = getMongoDb().collection('messages');
  const old = await messages.find({ encrypted: { $ne: true } }, { projection: { image: 1 } }).toArray();
  await Promise.all(
    old.flatMap((row) => (row.image ? [rm(resolve(config.UPLOAD_DIR, row.image.id), { force: true })] : [])),
  );
  const { deletedCount } = await messages.deleteMany({ encrypted: { $ne: true } });
  console.log(`Deleted ${deletedCount} old messages.`);
}

async function main(): Promise<void> {
  await connectMongodb();
  if (await needsMigration()) {
    if (await hasColumn('users', 'username')) {
      await migrateUsers();
      await createSecurityTables();
      await migrateChannels();
      await migrateMessages();
      await ensureMessageIndexes();
    } else if (!(await hasColumn('servers', 'slot')) || !(await hasColumn('users', 'avatar_id'))) {
      throw new Error('This database has an unreleased test schema. Empty it and let the app recreate its tables.');
    }
    await migratePermissions();
    console.log('Migration complete.');
  } else {
    console.log('The database is already migrated.');
  }
  if (process.argv.includes('--purge-old-messages')) await purgeOldMessages();
  await pool.end();
  await closeMongodb();
}

main().catch((err) => {
  console.error('Migration failed. Restore your backup before trying again:', err);
  process.exit(1);
});
