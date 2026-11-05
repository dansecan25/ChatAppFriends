import { Router } from 'express';
import * as channelController from '../controllers/channelController.js';
import * as fileController from '../controllers/fileController.js';
import * as messageController from '../controllers/messageController.js';
import { requireAuth } from '../middlewares/auth.js';

export const channelRoutes = Router();

channelRoutes.use(requireAuth);
channelRoutes.delete('/:channelId', channelController.remove);
channelRoutes.put('/:channelId/roles', channelController.setRoles);
channelRoutes.get('/:channelId/keys', channelController.keys);
channelRoutes.post('/:channelId/keys', channelController.shareKeys);
channelRoutes.post('/:channelId/rotate', channelController.rotate);
channelRoutes.get('/:channelId/messages', messageController.list);
channelRoutes.post('/:channelId/messages', messageController.create);
channelRoutes.post('/:channelId/uploads', fileController.startUpload);
