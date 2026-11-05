import { findDmByPair, insertDm, listDmsForUser, shareServer, type DmConversation } from '../models/dmModel.js';
import { findUsersByIds } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { emitToUsers } from './realtimeService.js';

/** Maps a conversation to what one participant needs. */
async function toDtoFor(dm: DmConversation, userId: number) {
  const otherId = dm.userLow === userId ? dm.userHigh : dm.userLow;
  const other = (await findUsersByIds([otherId])).get(otherId);
  return {
    id: dm.id,
    otherUser: { id: otherId, username: other?.username ?? 'Deleted user', publicKey: other?.publicKey ?? null },
    wrappedKey: dm.userLow === userId ? dm.wrappedKeyLow : dm.wrappedKeyHigh,
  };
}

/** Lists a user's conversations. */
export async function getDms(userId: number) {
  return Promise.all((await listDmsForUser(userId)).map((dm) => toDtoFor(dm, userId)));
}

/** Opens a conversation with someone in a shared server, or returns the existing one. */
export async function openDm(userId: number, otherId: number, wrappedKeySelf: string, wrappedKeyOther: string) {
  if (userId === otherId) throw new HttpError(400, 'You cannot message yourself');
  if (!(await shareServer(userId, otherId))) throw new HttpError(404, 'User not found');

  const [low, high] = userId < otherId ? [userId, otherId] : [otherId, userId];
  const existing = await findDmByPair(low, high);
  if (existing) return toDtoFor(existing, userId);

  const [wrappedLow, wrappedHigh] = userId < otherId ? [wrappedKeySelf, wrappedKeyOther] : [wrappedKeyOther, wrappedKeySelf];
  let id: number;
  try {
    id = await insertDm(low, high, wrappedLow, wrappedHigh);
  } catch (err) {
    if ((err as { code?: string }).code !== 'ER_DUP_ENTRY') throw err;
    const raced = await findDmByPair(low, high);
    if (!raced) throw err;
    return toDtoFor(raced, userId);
  }
  emitToUsers([otherId], 'dm:created', { id });
  return toDtoFor({ id, userLow: low, userHigh: high, wrappedKeyLow: wrappedLow, wrappedKeyHigh: wrappedHigh }, userId);
}
