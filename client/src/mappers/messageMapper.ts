import type { ImageDto, MessageDto } from '@/types/dto';
import type { Message, MessageImage } from '@/types/models';
import { API_URL } from '@/utils/env';
import { formatBytes, formatMessageTime } from '@/utils/format';
import { shouldLoadOnDemand } from '@/utils/images';
import { toUser } from './userMapper';

const toMessageImage = (dto: ImageDto): MessageImage => {
  const url = `${API_URL}/api/images/${dto.id}`;
  return {
    id: dto.id,
    filename: dto.filename,
    size: dto.size,
    sizeLabel: formatBytes(dto.size),
    url,
    downloadUrl: `${url}?download=1`,
    loadsOnDemand: shouldLoadOnDemand(dto.size),
  };
};

/** Maps an API message to the display model. */
export const toMessage = (dto: MessageDto): Message => {
  const createdAt = new Date(dto.createdAt);
  return {
    id: dto.id,
    channelId: dto.channelId,
    author: toUser(dto.author),
    content: dto.content,
    image: dto.image ? toMessageImage(dto.image) : null,
    createdAt,
    timeLabel: formatMessageTime(createdAt),
  };
};
