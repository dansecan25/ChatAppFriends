import { ObjectId, type Collection } from 'mongodb';
import { getMongoDb } from '../connections/mongodb.js';

export interface ImageAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MessageDocument {
  _id: ObjectId;
  channelId: number;
  authorId: number;
  authorUsername: string;
  content: string;
  image: ImageAttachment | null;
  createdAt: Date;
}

const messages = (): Collection<MessageDocument> => getMongoDb().collection<MessageDocument>('messages');

/** Stores a message and returns the saved document. */
export async function insertMessage(message: Omit<MessageDocument, '_id'>): Promise<MessageDocument> {
  const document = { ...message, _id: new ObjectId() };
  await messages().insertOne(document);
  return document;
}

/** Returns a page of messages, newest first, optionally older than a message id. */
export async function findMessages(channelId: number, limit: number, before?: string): Promise<MessageDocument[]> {
  const filter = before ? { channelId, _id: { $lt: new ObjectId(before) } } : { channelId };
  return messages().find(filter).sort({ _id: -1 }).limit(limit).toArray();
}

/** Finds the image metadata for an image id. */
export async function findImageById(imageId: string): Promise<ImageAttachment | null> {
  const message = await messages().findOne({ 'image.id': imageId }, { projection: { image: 1 } });
  return message?.image ?? null;
}

/** Lists the image ids stored in a channel. */
export async function findChannelImageIds(channelId: number): Promise<string[]> {
  const rows = await messages()
    .find({ channelId, image: { $ne: null } }, { projection: { image: 1 } })
    .toArray();
  return rows.flatMap((row) => (row.image ? [row.image.id] : []));
}

/** Deletes every message in a channel. */
export async function deleteChannelMessages(channelId: number): Promise<void> {
  await messages().deleteMany({ channelId });
}
