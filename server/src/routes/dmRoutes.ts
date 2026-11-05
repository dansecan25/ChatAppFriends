import { Router } from 'express';
import * as dmController from '../controllers/dmController.js';
import * as fileController from '../controllers/fileController.js';
import * as messageController from '../controllers/messageController.js';
import { requireAuth } from '../middlewares/auth.js';

export const dmRoutes = Router();

dmRoutes.use(requireAuth);
dmRoutes.get('/', dmController.list);
dmRoutes.post('/', dmController.open);
dmRoutes.get('/:dmId/messages', messageController.list);
dmRoutes.post('/:dmId/messages', messageController.create);
dmRoutes.patch('/:dmId/messages/:messageId', messageController.edit);
dmRoutes.delete('/:dmId/messages/:messageId', messageController.remove);
dmRoutes.post('/:dmId/uploads', fileController.startUpload);
