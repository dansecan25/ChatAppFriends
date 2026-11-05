import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { listDmsForUser, shareServer } from '../models/dmModel.js';
import { listServersForUser, setNickname } from '../models/serverModel.js';
import { findUserByAvatarId, findUserById, setAvatarId } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { sniffAvatarExtension } from '../utils/imageSniffer.js';
import { uploadDirectory } from './fileService.js';
import { emitToServer, emitToUsers } from './realtimeService.js';

export const avatarDirectory = resolve(uploadDirectory, 'avatars');

/** Tells everyone who can see this user to refresh how they look. */
async function announceProfileChange(userId: number): Promise<void> {
  for (const server of await listServersForUser(userId)) {
    emitToServer(server.id, 'roles:changed', { serverId: server.id });
  }
  const partners = (await listDmsForUser(userId)).map((dm) => (dm.userLow === userId ? dm.userHigh : dm.userLow));
  emitToUsers(partners, 'dm:updated', {});
}

const deleteAvatarFile = async (avatarId: string | null): Promise<void> => {
  if (!avatarId) return;
  await unlink(resolve(avatarDirectory, avatarId)).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') throw err;
  });
};

/** Saves a new profile picture, replacing the old one. Returns its id. */
export async function saveAvatar(userId: number, data: Buffer): Promise<string> {
  const extension = sniffAvatarExtension(data);
  if (!extension) throw new HttpError(415, 'Profile pictures must be PNG, JPEG or WebP');
  await mkdir(avatarDirectory, { recursive: true });
  const avatarId = `${randomUUID()}.${extension}`;
  await writeFile(resolve(avatarDirectory, avatarId), data);
  const previous = (await findUserById(userId))?.avatarId ?? null;
  await setAvatarId(userId, avatarId);
  await deleteAvatarFile(previous);
  await announceProfileChange(userId);
  return avatarId;
}

/** Removes a user's profile picture. */
export async function removeAvatar(userId: number): Promise<void> {
  const previous = (await findUserById(userId))?.avatarId ?? null;
  await setAvatarId(userId, null);
  await deleteAvatarFile(previous);
  await announceProfileChange(userId);
}

/** Requires that the viewer shares a server with the picture's owner. Other people can't tell it exists. */
export async function requireAvatarAccess(avatarId: string, viewerId: number): Promise<void> {
  const owner = await findUserByAvatarId(avatarId);
  const allowed = !!owner && (owner.id === viewerId || (await shareServer(owner.id, viewerId)));
  if (!allowed) throw new HttpError(404, 'Picture not found');
}

/** Sets or clears a member's nickname in one server. Their account name doesn't change. */
export async function updateNickname(serverId: number, userId: number, nickname: string | null): Promise<void> {
  await setNickname(serverId, userId, nickname);
  emitToServer(serverId, 'roles:changed', { serverId });
}
