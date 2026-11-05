import { getIo } from '../connections/socket.js';
import {
  deleteChannelById,
  findChannelById,
  insertChannel,
  listChannels,
  type Channel,
  type ChannelType,
} from '../models/channelModel.js';
import { deleteChannelMessages, findChannelImageIds } from '../models/messageModel.js';
import { HttpError } from '../utils/httpError.js';
import { deleteImageFile } from './imageService.js';
import { removeVoiceChannelPeers } from './voiceService.js';

const normalizeName = (name: string, type: ChannelType) => {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return type === 'text' ? trimmed.toLowerCase().replaceAll(' ', '-') : trimmed;
};

/** Creates the starter channels on a brand new server. */
export async function seedDefaultChannels(): Promise<void> {
  if ((await listChannels()).length > 0) return;
  await insertChannel('general', 'text', null);
  await insertChannel('General', 'voice', null);
}

export { listChannels };

/** Creates a channel and announces it to everyone. */
export async function createChannel(name: string, type: ChannelType, userId: number): Promise<Channel> {
  try {
    const channel = await insertChannel(normalizeName(name, type), type, userId);
    getIo().emit('channel:created', channel);
    return channel;
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'A channel with that name already exists');
    }
    throw err;
  }
}

/** Returns a channel of the required type or throws. */
export async function requireChannel(id: number, type: ChannelType): Promise<Channel> {
  const channel = await findChannelById(id);
  if (!channel || channel.type !== type) throw new HttpError(404, 'Channel not found');
  return channel;
}

/** Deletes a channel and its content; only its creator may do this. */
export async function deleteChannel(id: number, userId: number): Promise<void> {
  const channel = await findChannelById(id);
  if (!channel) throw new HttpError(404, 'Channel not found');
  if (channel.createdBy !== userId) throw new HttpError(403, 'Only the channel creator can delete it');

  await deleteChannelById(id);
  removeVoiceChannelPeers(id);
  const imageIds = await findChannelImageIds(id);
  await deleteChannelMessages(id);
  await Promise.all(imageIds.map(deleteImageFile));
  getIo().emit('channel:deleted', { id });
}
