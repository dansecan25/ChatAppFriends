import type { Request, Response } from 'express';
import { z } from 'zod';
import { isProduction } from '../config.js';
import { currentUser } from '../middlewares/auth.js';
import type { AuthUser } from '../models/userModel.js';
import * as authService from '../services/authService.js';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS, signSession } from '../utils/token.js';

const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: isProduction, path: '/' } as const;

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(32),
  password: z.string().min(1, 'Enter your password').max(200),
});

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}_.-]{2,32}$/u, 'Usernames need 2-32 letters, numbers, dots, dashes or underscores'),
  password: z.string().min(8, 'Passwords need at least 8 characters').max(200),
  inviteCode: z.string().max(200),
});

const startSession = (res: Response, user: AuthUser) => {
  res.cookie(SESSION_COOKIE, signSession(user), { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
  res.json(user);
};

/** POST /auth/register */
export async function register(req: Request, res: Response): Promise<void> {
  const { username, password, inviteCode } = registerSchema.parse(req.body);
  res.status(201);
  startSession(res, await authService.register(username, password, inviteCode));
}

/** POST /auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = loginSchema.parse(req.body);
  startSession(res, await authService.login(username, password));
}

/** POST /auth/logout */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
}

/** GET /auth/me */
export function me(req: Request, res: Response): void {
  res.json(currentUser(req));
}
