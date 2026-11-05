import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { AuthUser } from '../models/userModel.js';

export const SESSION_COOKIE = 'chatapp_session';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Creates a signed session token for a user. */
export function signSession(user: AuthUser): string {
  return jwt.sign({ username: user.username }, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

/** Returns the user in a session token, or null when it is invalid. */
export function verifySession(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    return { id: Number(payload.sub), username: String(payload.username) };
  } catch {
    return null;
  }
}
