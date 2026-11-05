import type { Request, Response } from 'express';
import { z } from 'zod';
import { isProduction } from '../config.js';
import { currentUser } from '../middlewares/auth.js';
import { findUserById, type AuthUser, type UserRecord } from '../models/userModel.js';
import * as authService from '../services/authService.js';
import { HttpError } from '../utils/httpError.js';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS, signSession } from '../utils/token.js';
import { hexKeySchema, inviteCodeSchema, opaqueSchema } from './schemas.js';

const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: isProduction, path: '/' } as const;

const usernameSchema = z.string().trim().min(1, 'Enter your username').max(32);

const keysSchema = z.object({
  kdfSalt: z.string().min(1).max(64),
  publicKey: opaqueSchema,
  wrappedPrivateKey: opaqueSchema,
  recoveryWrappedPrivateKey: opaqueSchema,
  recoveryVerifier: hexKeySchema,
});

const preloginSchema = z.object({ username: usernameSchema });

const loginSchema = z.union([
  z.object({ username: usernameSchema, authKey: hexKeySchema }),
  z.object({ username: usernameSchema, password: z.string().min(1, 'Enter your password').max(200) }),
]);

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}_.-]{2,32}$/u, 'Usernames need 2-32 letters, numbers, dots, dashes or underscores'),
  authKey: hexKeySchema,
  keys: keysSchema,
  inviteCode: inviteCodeSchema,
});

const upgradeSchema = z.object({ authKey: hexKeySchema, keys: keysSchema });
const recoveryKeySchema = z.object({ username: usernameSchema, verifier: hexKeySchema });
const recoverSchema = recoveryKeySchema.extend({
  authKey: hexKeySchema,
  kdfSalt: z.string().min(1).max(64),
  wrappedPrivateKey: opaqueSchema,
});

const startSession = (res: Response, user: AuthUser) => {
  res.cookie(SESSION_COOKIE, signSession(user), { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
};

const toProfile = (user: UserRecord) => ({
  id: user.id,
  username: user.username,
  isOwner: user.isOwner,
  needsKeySetup: !user.kdfSalt,
});

const toLoginResponse = (user: UserRecord) => ({
  user: toProfile(user),
  keys: user.kdfSalt
    ? { kdfSalt: user.kdfSalt, wrappedPrivateKey: user.wrappedPrivateKey, publicKey: user.publicKey }
    : null,
});

/** POST /auth/prelogin */
export async function prelogin(req: Request, res: Response): Promise<void> {
  res.json(await authService.prelogin(preloginSchema.parse(req.body).username));
}

/** POST /auth/register */
export async function register(req: Request, res: Response): Promise<void> {
  const { username, authKey, keys, inviteCode } = registerSchema.parse(req.body);
  const user = await authService.register(username, authKey, keys, inviteCode);
  startSession(res, user);
  res.status(201).json(toProfile((await findUserById(user.id)) as UserRecord));
}

/** POST /auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, ...secret } = loginSchema.parse(req.body);
  const user = await authService.login(username, secret);
  startSession(res, user);
  res.json(toLoginResponse(user));
}

/** POST /auth/upgrade */
export async function upgrade(req: Request, res: Response): Promise<void> {
  const { authKey, keys } = upgradeSchema.parse(req.body);
  await authService.upgradeAccount(currentUser(req).id, authKey, keys);
  res.status(204).end();
}

/** POST /auth/recovery-key */
export async function recoveryKey(req: Request, res: Response): Promise<void> {
  const { username, verifier } = recoveryKeySchema.parse(req.body);
  res.json({ recoveryWrappedPrivateKey: await authService.getRecoveryKey(username, verifier) });
}

/** POST /auth/recover */
export async function recover(req: Request, res: Response): Promise<void> {
  const { username, verifier, authKey, kdfSalt, wrappedPrivateKey } = recoverSchema.parse(req.body);
  const user = await authService.recover(username, verifier, authKey, kdfSalt, wrappedPrivateKey);
  startSession(res, user);
  res.json(toLoginResponse(user));
}

/** POST /auth/logout */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
}

/** GET /auth/me */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await findUserById(currentUser(req).id);
  if (!user) throw new HttpError(401, 'Please sign in');
  res.json(toProfile(user));
}
