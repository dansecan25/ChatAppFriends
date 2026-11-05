import {
  findMessages,
  insertMessage,
  type Attachment,
  type LegacyImage,
  type MessageDocument,
  type MessageScope,
} from '../models/messageModel.js';
import { findChannelById } from '../models/channelModel.js';
import { findServerById } from '../models/serverModel.js';
import { shareServer } from '../models/dmModel.js';
import { findUsersByIds, type AuthUser } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { channelAudience, requireDmAccess, requireScopeAccess } from './accessService.js';
import { deleteStoredFile, finishUpload } from './fileService.js';
import { emitToUsers } from './realtimeService.js';

export interface MessageDto {
  id: string;
  channelId: number | null;
  dmId: number | null;
  author: AuthUser;
  encrypted: boolean;
  ciphertext: string | null;
  keyVersion: number;
  attachment: Attachment | null;
  content: string | null;
  image: LegacyImage | null;
  createdAt: string;
}

export interface EncryptedInput {
  ciphertext: string;
  keyVersion: number;
  uploadId?: string;
}

const DELETED_USER = 'Deleted user';

const toDtos = async (messages: MessageDocument[]): Promise<MessageDto[]> => {
  const authors = await findUsersByIds([...new Set(messages.map((message) => message.authorId))]);
  return messages.map((message) => ({
    id: message._id.toHexString(),
    channelId: message.channelId ?? null,
    dmId: message.dmId ?? null,
    author: { id: message.authorId, username: authors.get(message.authorId)?.username ?? DELETED_USER },
    encrypted: message.encrypted === true,
    ciphertext: message.ciphertext ?? null,
    keyVersion: message.keyVersion ?? 0,
    attachment: message.attachment ?? null,
    content: message.content ?? null,
    image: message.image ?? null,
    createdAt: message.createdAt.toISOString(),
  }));
};

/** Returns a page of messages in chronological order. */
export async function getMessages(
  scope: MessageScope,
  userId: number,
  limit: number,
  before?: string,
): Promise<MessageDto[]> {
  await requireScopeAccess(scope, userId);
  const page = await findMessages(scope, limit, before);
  return toDtos(page.reverse());
}

/** Lists who should receive a new message, refusing messages on a key that has been replaced. */
async function resolveRecipients(scope: MessageScope, userId: number, keyVersion: number): Promise<number[]> {
  if ('dmId' in scope) {
    const dm = await requireDmAccess(scope.dmId, userId);
    if (!(await shareServer(dm.userLow, dm.userHigh))) throw new HttpError(403, 'You no longer share a server with this person');
    return [dm.userLow, dm.userHigh];
  }
  const channel = await findChannelById(scope.channelId);
  if (!channel) throw new HttpError(404, 'Channel not found');
  const server = await findServerById(channel.serverId);
  const needsNewKey = channel.restricted
    ? channel.rotationPending || keyVersion !== channel.keyVersion
    : keyVersion !== server?.rootKeyVersion;
  if (needsNewKey) throw new HttpError(409, 'This channel needs a new key before messages can be sent');
  return channelAudience(channel);
}

/** Stores an encrypted message and delivers it. The server can't read its contents. */
export async function postMessage(scope: MessageScope, author: AuthUser, input: EncryptedInput): Promise<MessageDto> {
  await requireScopeAccess(scope, author.id);
  const recipients = await resolveRecipients(scope, author.id, input.keyVersion);
  const attachment = input.uploadId ? await finishUpload(input.uploadId, author.id, scope) : null;
  try {
    const message = await insertMessage({
      ...scope,
      authorId: author.id,
      encrypted: true,
      ciphertext: input.ciphertext,
      keyVersion: input.keyVersion,
      attachment,
      createdAt: new Date(),
    });
    const [dto] = await toDtos([message]);
    emitToUsers(recipients, 'message:new', dto);
    return dto;
  } catch (err) {
    if (attachment) await deleteStoredFile(attachment.id);
    throw err;
  }
}
