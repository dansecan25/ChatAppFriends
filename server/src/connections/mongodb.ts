import { MongoClient, type Db } from 'mongodb';
import { config } from '../config.js';

const client = new MongoClient(config.MONGODB_URI);
let database: Db | undefined;

/** Opens the MongoDB connection. */
export async function connectMongodb(): Promise<void> {
  await client.connect();
  database = client.db(config.MONGODB_DATABASE);
}

/** Returns the connected database. */
export function getMongoDb(): Db {
  if (!database) throw new Error('MongoDB is not connected');
  return database;
}

/** Closes the MongoDB connection. */
export async function closeMongodb(): Promise<void> {
  await client.close();
}
