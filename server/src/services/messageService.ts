import { getIo } from '../connections/socket.js';
import {
  findMessages,
  insertMessage,
  type ImageAttachment,
  type MessageDocument,
} from '../models/messageModel.js';
import type { AuthUser } from '../models/userModel.js';
import { requireChannel } from './channelService.js';

export interface MessageDto {
  id: string;
  channelId: number;
  author: AuthUser;
  content: string;
  image: ImageAttachment | null;
  createdAt: string;
}

const toDto = (message: MessageDocument): MessageDto => ({
  id: message._id.toHexString(),
  channelId: message.channelId,
  author: { id: message.authorId, username: message.authorUsername },
  content: message.content,
  image: message.image,
  createdAt: message.createdAt.toISOString(),
});

/** Returns a page of channel messages in chronological order. */
export async function getMessages(channelId: number, limit: number, before?: string): Promise<MessageDto[]> {
  await requireChannel(channelId, 'text');
  const page = await findMessages(channelId, limit, before);
  return page.reverse().map(toDto);
}

/** Saves a message and broadcasts it to all connected members. */
export async function postMessage(
  channelId: number,
  author: AuthUser,
  content: string,
  image: ImageAttachment | null = null,
): Promise<MessageDto> {
  await requireChannel(channelId, 'text');
  const message = await insertMessage({
    channelId,
    authorId: author.id,
    authorUsername: author.username,
    content,
    image,
    createdAt: new Date(),
  });
  const dto = toDto(message);
  getIo().emit('message:new', dto);
  return dto;
}
