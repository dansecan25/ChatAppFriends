import type { ChannelDto } from '@/types/dto';
import type { Channel } from '@/types/models';

/** Maps an API channel to the app model. */
export const toChannel = (dto: ChannelDto): Channel => ({
  id: dto.id,
  name: dto.name,
  type: dto.type,
  createdBy: dto.createdBy,
});
