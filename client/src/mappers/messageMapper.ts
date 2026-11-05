import { decryptMessage } from '@/services/crypto/messageCrypto';
import { threadKeyOf, type Thread } from '@/services/crypto/keyring';
import type { LegacyImageDto, MessageDto } from '@/types/dto';
import type { Message, MessageImage } from '@/types/models';
import { API_URL } from '@/utils/env';
import { errorMessage } from '@/utils/errors';
import { formatBytes, formatMessageTime } from '@/utils/format';
import { shouldLoadOnDemand } from '@/utils/images';
import { toUser } from './userMapper';

const toLegacyImage = (dto: LegacyImageDto): MessageImage => {
  const url = `${API_URL}/api/images/${dto.id}`;
  return {
    source: { kind: 'legacy', url, downloadUrl: `${url}?download=1` },
    filename: dto.filename,
    sizeLabel: formatBytes(dto.size),
    loadsOnDemand: shouldLoadOnDemand(dto.size),
  };
};

/** Maps an API message to the display model, decrypting it. Unreadable messages say why instead of failing. */
export async function toMessage(dto: MessageDto, thread: Thread): Promise<Message> {
  const createdAt = new Date(dto.createdAt);
  const base = {
    id: dto.id,
    threadKey: threadKeyOf(thread),
    author: toUser(dto.author),
    createdAt,
    timeLabel: formatMessageTime(createdAt),
    editedAt: dto.editedAt ? new Date(dto.editedAt) : null,
  };
  if (!dto.encrypted) {
    return {
      ...base,
      content: dto.content ?? '',
      image: dto.image ? toLegacyImage(dto.image) : null,
      protection: 'legacy',
    };
  }
  try {
    const { text, file } = await decryptMessage(thread, dto.author.id, dto.keyVersion, dto.ciphertext as string);
    const image: MessageImage | null =
      file && dto.attachment
        ? {
            source: { kind: 'encrypted', attachmentId: dto.attachment.id, file },
            filename: file.filename,
            sizeLabel: formatBytes(file.size),
            loadsOnDemand: shouldLoadOnDemand(file.size),
          }
        : null;
    return { ...base, content: text, image, protection: 'encrypted' };
  } catch (err) {
    return { ...base, content: errorMessage(err, 'This message could not be decrypted'), image: null, protection: 'locked' };
  }
}
