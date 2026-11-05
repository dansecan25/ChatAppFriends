import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Blocks state-changing requests from other origins, including other apps on this host. */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  const { origin } = req.headers;
  if (!SAFE_METHODS.has(req.method) && origin && origin !== config.CLIENT_ORIGIN) {
    throw new HttpError(403, 'Origin not allowed');
  }
  next();
}
