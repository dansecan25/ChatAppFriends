import { Router } from 'express';
import * as channelController from '../controllers/channelController.js';
import * as imageController from '../controllers/imageController.js';
import * as messageController from '../controllers/messageController.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadSingleImage } from '../middlewares/upload.js';

export const channelRoutes = Router();

channelRoutes.use(requireAuth);
channelRoutes.get('/', channelController.list);
channelRoutes.post('/', channelController.create);
channelRoutes.delete('/:channelId', channelController.remove);
channelRoutes.get('/:channelId/messages', messageController.list);
channelRoutes.post('/:channelId/messages', messageController.create);
channelRoutes.post('/:channelId/images', imageController.checkUpload, uploadSingleImage, imageController.upload);
