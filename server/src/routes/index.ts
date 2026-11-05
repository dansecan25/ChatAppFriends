import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { channelRoutes } from './channelRoutes.js';
import { dmRoutes } from './dmRoutes.js';
import { fileRoutes } from './fileRoutes.js';
import { inviteRoutes } from './inviteRoutes.js';
import { profileRoutes } from './profileRoutes.js';
import { serverRoutes } from './serverRoutes.js';

export const apiRoutes = Router();

apiRoutes.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
apiRoutes.use('/auth', authRoutes);
apiRoutes.use(profileRoutes);
apiRoutes.use('/invites', inviteRoutes);
apiRoutes.use('/servers', serverRoutes);
apiRoutes.use('/channels', channelRoutes);
apiRoutes.use('/dms', dmRoutes);
apiRoutes.use(fileRoutes);
