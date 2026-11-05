import type { VoiceParticipantDto } from '@/types/dto';
import type { VoiceParticipant } from '@/types/models';

/** Maps an API voice participant to the app model. */
export const toVoiceParticipant = (dto: VoiceParticipantDto): VoiceParticipant => ({
  userId: dto.userId,
  username: dto.username,
  muted: dto.muted,
  deafened: dto.deafened,
});
