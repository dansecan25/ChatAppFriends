import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import { requireMember } from '../services/accessService.js';
import * as profileService from '../services/profileService.js';
import { HttpError } from '../utils/httpError.js';
import { idSchema } from './schemas.js';

const avatarIdSchema = z.string().regex(/^[a-f\d-]{36}\.(png|jpg|webp)$/);
const nicknameSchema = z.object({
  nickname: z.string().trim().max(32, 'Nicknames can have up to 32 characters').transform((value) => value || null),
});

/** PUT /users/me/avatar */
export async function putAvatar(req: Request, res: Response): Promise<void> {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Choose a picture');
  res.json({ avatarId: await profileService.saveAvatar(currentUser(req).id, req.body) });
}

/** DELETE /users/me/avatar */
export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  await profileService.removeAvatar(currentUser(req).id);
  res.status(204).end();
}

/** GET /avatars/:avatarId */
export async function getAvatar(req: Request, res: Response): Promise<void> {
  const parsed = avatarIdSchema.safeParse(req.params.avatarId);
  if (!parsed.success) throw new HttpError(404, 'Picture not found');
  await profileService.requireAvatarAccess(parsed.data, currentUser(req).id);
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(parsed.data, { root: profileService.avatarDirectory });
}

/** PUT /servers/:serverId/nickname */
export async function putNickname(req: Request, res: Response): Promise<void> {
  const serverId = idSchema.parse(req.params.serverId);
  const userId = currentUser(req).id;
  await requireMember(serverId, userId);
  await profileService.updateNickname(serverId, userId, nicknameSchema.parse(req.body).nickname);
  res.status(204).end();
}
