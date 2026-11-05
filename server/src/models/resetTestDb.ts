import { config } from '../config.js';
import { pool } from '../connections/mariadb.js';
import { closeMongodb, connectMongodb, getMongoDb } from '../connections/mongodb.js';

const TEST_DATABASE = 'chatapp-test-env';

/** Drops every table, ignoring foreign keys so the order doesn't matter. */
async function emptyMariadb(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    const tables: { name: string }[] = await connection.query(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    );
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { name } of tables) await connection.query(`DROP TABLE \`${name}\``);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`MariaDB: dropped ${tables.length} tables.`);
  } finally {
    await connection.release();
  }
}

/** Drops every collection, which a user limited to this database is allowed to do. */
async function emptyMongodb(): Promise<void> {
  const collections = await getMongoDb().listCollections().toArray();
  for (const { name } of collections) await getMongoDb().dropCollection(name);
  console.log(`MongoDB: dropped ${collections.length} collections.`);
}

async function main(): Promise<void> {
  if (config.MARIADB_DATABASE !== TEST_DATABASE || config.MONGODB_DATABASE !== TEST_DATABASE) {
    throw new Error(`Refusing to run: both databases in server/.env must be ${TEST_DATABASE}. Nothing was changed.`);
  }
  await connectMongodb();
  await emptyMariadb();
  await emptyMongodb();
  await pool.end();
  await closeMongodb();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
