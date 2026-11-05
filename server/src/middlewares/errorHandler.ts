import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

const describe = (err: unknown): { status: number; message: string } | null => {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  if (err instanceof ZodError) return { status: 400, message: err.issues[0]?.message ?? 'Invalid request' };
  if ((err as { type?: string }).type === 'entity.too.large') return { status: 413, message: 'That is too large' };
  return null;
};

/** Turns thrown errors into JSON responses, hiding unexpected details. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (req.socket.destroyed) return;
  if (res.headersSent) return next(err);
  const known = describe(err);
  if (!known) console.error(err);
  res.status(known?.status ?? 500).json({ error: known?.message ?? 'Something went wrong' });
}
