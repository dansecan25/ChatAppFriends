import { Router } from 'express';
import * as imageController from '../controllers/imageController.js';
import { requireAuth } from '../middlewares/auth.js';

export const imageRoutes = Router();

imageRoutes.get('/:imageId', requireAuth, imageController.download);
