import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import type { MessageScope } from '../models/messageModel.js';
import * as messageService from '../services/messageService.js';
import { idSchema } from './schemas.js';

const pageSchema = z.object({
  before: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const postSchema = z.object({
  ciphertext: z.string().min(1).max(32_768),
  keyVersion: z.number().int().min(0),
  uploadId: z.uuid().optional(),
});

/** Reads a route's message location from its parameters. */
export const scopeOf = (req: Request): MessageScope =>
  req.params.dmId ? { dmId: idSchema.parse(req.params.dmId) } : { channelId: idSchema.parse(req.params.channelId) };

/** GET /channels/:channelId/messages and /dms/:dmId/messages */
export async function list(req: Request, res: Response): Promise<void> {
  const { before, limit } = pageSchema.parse(req.query);
  res.json(await messageService.getMessages(scopeOf(req), currentUser(req).id, limit, before));
}

/** POST /channels/:channelId/messages and /dms/:dmId/messages */
export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(await messageService.postMessage(scopeOf(req), currentUser(req), postSchema.parse(req.body)));
}
