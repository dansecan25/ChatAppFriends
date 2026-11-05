import {
  advanceKeyVersion,
  deleteChannelById,
  findChannelById,
  insertChannel,
  insertKeyEnvelopes,
  listChannels,
  listKeyEnvelopes,
  listKeyHolders,
  type Channel,
  type ChannelType,
  type KeyEnvelope,
} from '../models/channelModel.js';
import { deleteChannelMessages, findChannelFileIds } from '../models/messageModel.js';
import { findRoleById } from '../models/roleModel.js';
import { HttpError } from '../utils/httpError.js';
import { channelAudience, isServerAdmin, requireChannelAccess } from './accessService.js';
import { deleteStoredFile } from './fileService.js';
import { emitToServer, emitToUsers } from './realtimeService.js';
import { removeVoiceChannelPeers } from './voiceService.js';

const normalizeName = (name: string, type: ChannelType) => {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return type === 'text' ? trimmed.toLowerCase().replaceAll(' ', '-') : trimmed;
};

/** Lists the channels a user may see in a server. */
export async function getVisibleChannels(serverId: number, userId: number): Promise<Channel[]> {
  const channels = await listChannels(serverId);
  const visible = await Promise.all(
    channels.map(async (channel) => ((await channelAudience(channel)).includes(userId) ? channel : null)),
  );
  return visible.filter((channel) => channel !== null);
}

/** Creates a channel and announces it to those who may see it. */
export async function createChannel(
  serverId: number,
  name: string,
  type: ChannelType,
  userId: number,
  roleIds: number[],
  envelopes: KeyEnvelope[],
): Promise<Channel> {
  for (const roleId of roleIds) {
    if ((await findRoleById(roleId))?.serverId !== serverId) throw new HttpError(404, 'Role not found');
  }
  const encryptedRestricted = roleIds.length > 0 && type === 'text';
  if (encryptedRestricted && !envelopes.some((envelope) => envelope.userId === userId)) {
    throw new HttpError(400, 'A restricted channel needs a key for its creator');
  }

  let channel: Channel;
  try {
    channel = await insertChannel(serverId, normalizeName(name, type), type, userId, roleIds);
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'A channel with that name already exists');
    }
    throw err;
  }
  const audience = await channelAudience(channel);
  if (encryptedRestricted) {
    await insertKeyEnvelopes(
      channel.id,
      envelopes.filter((envelope) => envelope.version === 0 && audience.includes(envelope.userId)),
    );
  }
  emitToUsers(audience, 'channel:created', channel);
  return channel;
}

/** Deletes a channel and its content. Its creator or a server admin may do this. */
export async function deleteChannel(id: number, userId: number): Promise<void> {
  const channel = await findChannelById(id);
  if (!channel) throw new HttpError(404, 'Channel not found');
  const allowed = channel.createdBy === userId || (await isServerAdmin(channel.serverId, userId));
  if (!allowed) throw new HttpError(403, 'Only the channel creator or an admin can delete it');

  const audience = await channelAudience(channel);
  await deleteChannelById(id);
  removeVoiceChannelPeers(id);
  const fileIds = await findChannelFileIds(id);
  await deleteChannelMessages(id);
  await Promise.all(fileIds.map(deleteStoredFile));
  emitToUsers(audience, 'channel:deleted', { id, serverId: channel.serverId });
}

/** Returns a user's copies of a restricted channel's keys. */
export async function getChannelKeys(channelId: number, userId: number) {
  const channel = await requireChannelAccess(channelId, userId);
  return { keyVersion: channel.keyVersion, envelopes: await listKeyEnvelopes(channelId, userId) };
}

/** Lists the key sharing this user's browser can do, since only browsers can read keys. */
export async function getKeyWork(serverId: number, userId: number) {
  const channels = (await getVisibleChannels(serverId, userId)).filter(
    (channel) => channel.restricted && channel.type === 'text',
  );
  const grants: { channelId: number; version: number; userId: number }[] = [];
  const rotations: number[] = [];

  for (const channel of channels) {
    const holders = await listKeyHolders(channel.id);
    const myVersions = holders.filter((holder) => holder.userId === userId).map((holder) => holder.version);
    if (myVersions.length === 0) continue;
    if (channel.rotationPending && myVersions.includes(channel.keyVersion)) rotations.push(channel.id);
    for (const target of await channelAudience(channel)) {
      for (const version of myVersions) {
        if (!holders.some((holder) => holder.userId === target && holder.version === version)) {
          grants.push({ channelId: channel.id, version, userId: target });
        }
      }
    }
  }
  return { grants, rotations };
}

/** Stores keys a member's browser shared with others who are allowed in the channel. */
export async function shareChannelKeys(channelId: number, userId: number, envelopes: KeyEnvelope[]): Promise<void> {
  const channel = await requireChannelAccess(channelId, userId);
  const audience = await channelAudience(channel);
  const myVersions = (await listKeyEnvelopes(channelId, userId)).map((envelope) => envelope.version);
  const allowed = envelopes.filter(
    (envelope) => audience.includes(envelope.userId) && myVersions.includes(envelope.version),
  );
  await insertKeyEnvelopes(channelId, allowed);
  emitToUsers([...new Set(allowed.map((envelope) => envelope.userId))], 'access:changed', {
    serverId: channel.serverId,
  });
}

/** Moves a channel to a new key after someone lost access, so they can't read what comes next. */
export async function rotateChannelKey(
  channelId: number,
  userId: number,
  version: number,
  envelopes: KeyEnvelope[],
): Promise<void> {
  const channel = await requireChannelAccess(channelId, userId);
  if (!channel.restricted || channel.type !== 'text') throw new HttpError(400, 'This channel has no key to change');
  const audience = await channelAudience(channel);
  const allowed = envelopes.filter((envelope) => envelope.version === version && audience.includes(envelope.userId));
  if (!allowed.some((envelope) => envelope.userId === userId)) throw new HttpError(400, 'Missing your own new key');
  if (!(await advanceKeyVersion(channelId, version))) throw new HttpError(409, 'The key already changed');
  await insertKeyEnvelopes(channelId, allowed);
  emitToUsers(audience, 'access:changed', { serverId: channel.serverId });
  emitToServer(channel.serverId, 'keys:needed', { serverId: channel.serverId });
}
