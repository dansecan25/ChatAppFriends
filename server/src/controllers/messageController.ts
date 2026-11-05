import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import type { MessageScope } from '../models/messageModel.js';
import * as messageService from '../services/messageService.js';
import { idSchema } from './schemas.js';

const messageIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

const pageSchema = z.object({
  before: messageIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const editSchema = z.object({
  ciphertext: z.string().min(1).max(32_768),
  keyVersion: z.number().int().min(0),
});

const postSchema = editSchema.extend({ uploadId: z.uuid().optional() });

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

/** PATCH /channels/:channelId/messages/:messageId and /dms/:dmId/messages/:messageId */
export async function edit(req: Request, res: Response): Promise<void> {
  const messageId = messageIdSchema.parse(req.params.messageId);
  res.json(await messageService.editMessage(scopeOf(req), currentUser(req).id, messageId, editSchema.parse(req.body)));
}

/** DELETE /channels/:channelId/messages/:messageId and /dms/:dmId/messages/:messageId */
export async function remove(req: Request, res: Response): Promise<void> {
  await messageService.deleteMessage(scopeOf(req), currentUser(req).id, messageIdSchema.parse(req.params.messageId));
  res.status(204).end();
}
