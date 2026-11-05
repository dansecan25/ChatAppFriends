import type { DmDto } from '@/types/dto';
import { request } from './http';

/** Lists the user's conversations. */
export const fetchDms = (): Promise<DmDto[]> => request('/dms');

/** Opens a conversation, or returns the one that already exists. */
export const openDm = (userId: number, wrappedKeySelf: string, wrappedKeyOther: string): Promise<DmDto> =>
  request('/dms', { method: 'POST', body: { userId, wrappedKeySelf, wrappedKeyOther } });
