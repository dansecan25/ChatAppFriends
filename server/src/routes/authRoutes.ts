import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again in a few minutes' },
});

export const authRoutes = Router();

authRoutes.post('/register', credentialLimiter, authController.register);
authRoutes.post('/login', credentialLimiter, authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
