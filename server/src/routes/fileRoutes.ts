import express, { Router } from 'express';
import * as fileController from '../controllers/fileController.js';
import { requireAuth } from '../middlewares/auth.js';
import { MAX_CHUNK_BYTES } from '../services/fileService.js';

export const fileRoutes = Router();

fileRoutes.use(requireAuth);
fileRoutes.put(
  '/uploads/:uploadId/chunks/:index',
  express.raw({ type: 'application/octet-stream', limit: MAX_CHUNK_BYTES }),
  fileController.putChunk,
);
fileRoutes.delete('/uploads/:uploadId', fileController.cancelUpload);
fileRoutes.get('/attachments/:attachmentId', fileController.downloadAttachment);
fileRoutes.get('/images/:imageId', fileController.downloadLegacyImage);
