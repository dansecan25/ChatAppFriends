import { toChannel } from '@/mappers/channelMapper';
import type { ChannelDto, ChannelType } from '@/types/dto';
import type { Channel } from '@/types/models';
import { request } from './http';

/** Lists all channels. */
export const fetchChannels = async (): Promise<Channel[]> =>
  (await request<ChannelDto[]>('/channels')).map(toChannel);

/** Creates a channel. */
export const createChannel = async (name: string, type: ChannelType): Promise<Channel> =>
  toChannel(await request<ChannelDto>('/channels', { method: 'POST', body: { name, type } }));

/** Deletes a channel. */
export const deleteChannel = (id: number): Promise<void> => request(`/channels/${id}`, { method: 'DELETE' });
