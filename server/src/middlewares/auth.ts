import { parseCookie } from 'cookie';
import type { NextFunction, Request, Response } from 'express';
import type { Socket } from 'socket.io';
import type { AuthUser } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { SESSION_COOKIE, verifySession } from '../utils/token.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const userFromCookieHeader = (header: string | undefined) => verifySession(parseCookie(header ?? '')[SESSION_COOKIE]);

/** Requires a valid session cookie on an HTTP request. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const user = userFromCookieHeader(req.headers.cookie);
  if (!user) throw new HttpError(401, 'Please sign in');
  req.user = user;
  next();
}

/** Returns the signed-in user of a request that passed requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  return req.user;
}

/** Requires a valid session cookie when a socket connects. */
export function requireSocketAuth(socket: Socket, next: (err?: Error) => void): void {
  const user = userFromCookieHeader(socket.handshake.headers.cookie);
  if (!user) return next(new Error('Please sign in'));
  socket.data.user = user;
  next();
}
