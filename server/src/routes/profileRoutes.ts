import express, { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { requireAuth } from '../middlewares/auth.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const profileRoutes = Router();

profileRoutes.use(requireAuth);
profileRoutes.put(
  '/users/me/avatar',
  express.raw({ type: () => true, limit: MAX_AVATAR_BYTES }),
  profileController.putAvatar,
);
profileRoutes.delete('/users/me/avatar', profileController.deleteAvatar);
profileRoutes.get('/avatars/:avatarId', profileController.getAvatar);
profileRoutes.put('/servers/:serverId/nickname', profileController.putNickname);
