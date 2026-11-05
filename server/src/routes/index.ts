import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { channelRoutes } from './channelRoutes.js';
import { imageRoutes } from './imageRoutes.js';

export const apiRoutes = Router();

apiRoutes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/channels', channelRoutes);
apiRoutes.use('/images', imageRoutes);
