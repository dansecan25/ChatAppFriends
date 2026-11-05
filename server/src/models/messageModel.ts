import { ObjectId, type Collection } from 'mongodb';
import { getMongoDb } from '../connections/mongodb.js';

/** A message's location: a channel or a DM conversation. */
export type MessageScope = { channelId: number } | { dmId: number };

/** An image from before encryption, stored readable on disk. */
export interface LegacyImage {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** An encrypted file. Its name, type and key are inside the encrypted message. */
export interface Attachment {
  id: string;
  encryptedSize: number;
}

export interface MessageDocument {
  _id: ObjectId;
  channelId?: number;
  dmId?: number;
  authorId: number;
  encrypted?: boolean;
  ciphertext?: string;
  keyVersion?: number;
  attachment?: Attachment | null;
  content?: string;
  image?: LegacyImage | null;
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
export async function findMessages(scope: MessageScope, limit: number, before?: string): Promise<MessageDocument[]> {
  const filter = before ? { ...scope, _id: { $lt: new ObjectId(before) } } : scope;
  return messages().find(filter).sort({ _id: -1 }).limit(limit).toArray();
}

/** Finds the message holding an old readable image. */
export async function findMessageByImageId(imageId: string): Promise<MessageDocument | null> {
  return messages().findOne({ 'image.id': imageId });
}

/** Finds the message holding an encrypted file. */
export async function findMessageByAttachmentId(attachmentId: string): Promise<MessageDocument | null> {
  return messages().findOne({ 'attachment.id': attachmentId });
}

/** Lists the stored file ids in a channel, both old images and encrypted files. */
export async function findChannelFileIds(channelId: number): Promise<string[]> {
  const rows = await messages()
    .find({ channelId }, { projection: { image: 1, attachment: 1 } })
    .toArray();
  return rows.flatMap((row) => [row.image?.id, row.attachment?.id].filter((id): id is string => !!id));
}

/** Deletes every message in a channel. */
export async function deleteChannelMessages(channelId: number): Promise<void> {
  await messages().deleteMany({ channelId });
}
