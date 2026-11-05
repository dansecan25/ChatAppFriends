import { Router } from 'express';
import * as inviteController from '../controllers/inviteController.js';
import { requireAuth } from '../middlewares/auth.js';
import { credentialLimiter } from '../middlewares/rateLimits.js';

export const inviteRoutes = Router();

inviteRoutes.post('/redeem', credentialLimiter, requireAuth, inviteController.redeem);
inviteRoutes.post('/revoke', requireAuth, inviteController.revoke);
