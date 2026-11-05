import type { UserDto } from '@/types/dto';
import type { User } from '@/types/models';

/** Maps an API user to the app model. */
export const toUser = (dto: UserDto): User => ({ id: dto.id, username: dto.username });
