import { toChannel } from '@/mappers/channelMapper';
import type { ChannelDto, ChannelType, KeyEnvelopeDto, KeyWorkDto } from '@/types/dto';
import type { Channel } from '@/types/models';
import { request } from './http';

/** Lists the channels this user may see in a server. */
export const fetchChannels = async (serverId: number): Promise<Channel[]> =>
  (await request<ChannelDto[]>(`/servers/${serverId}/channels`)).map(toChannel);

/** Creates a channel. */
export const createChannel = async (
  serverId: number,
  body: { name: string; type: ChannelType; roleIds: number[]; envelopes: KeyEnvelopeDto[] },
): Promise<Channel> => toChannel(await request<ChannelDto>(`/servers/${serverId}/channels`, { method: 'POST', body }));

/** Deletes a channel. */
export const deleteChannel = (id: number): Promise<void> => request(`/channels/${id}`, { method: 'DELETE' });

/** Replaces the roles allowed in a restricted channel. */
export const setChannelRoles = (id: number, roleIds: number[]): Promise<void> =>
  request(`/channels/${id}/roles`, { method: 'PUT', body: { roleIds } });

/** Returns this user's copies of a channel's keys. */
export const fetchChannelKeys = (id: number): Promise<{ keyVersion: number; envelopes: KeyEnvelopeDto[] }> =>
  request(`/channels/${id}/keys`);

/** Lists the key sharing this browser can do for a server. */
export const fetchKeyWork = (serverId: number): Promise<KeyWorkDto> => request(`/servers/${serverId}/key-work`);

/** Shares a channel's keys with other members. */
export const shareChannelKeys = (id: number, envelopes: KeyEnvelopeDto[]): Promise<void> =>
  request(`/channels/${id}/keys`, { method: 'POST', body: { envelopes } });

/** Moves a channel to a new key. */
export const rotateChannelKey = (id: number, version: number, envelopes: KeyEnvelopeDto[]): Promise<void> =>
  request(`/channels/${id}/rotate`, { method: 'POST', body: { version, envelopes } });
