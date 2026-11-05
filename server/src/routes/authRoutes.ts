import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { credentialLimiter } from '../middlewares/rateLimits.js';

export const authRoutes = Router();

authRoutes.post('/prelogin', credentialLimiter, authController.prelogin);
authRoutes.post('/register', credentialLimiter, authController.register);
authRoutes.post('/login', credentialLimiter, authController.login);
authRoutes.post('/upgrade', requireAuth, authController.upgrade);
authRoutes.post('/recovery-key', credentialLimiter, authController.recoveryKey);
authRoutes.post('/recover', credentialLimiter, authController.recover);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
