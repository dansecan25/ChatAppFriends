import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import * as messageService from '../services/messageService.js';
import { channelIdSchema } from './channelController.js';

const pageSchema = z.object({
  before: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const postSchema = z.object({
  content: z.string().trim().min(1, 'Message is empty').max(4000, 'Messages can have up to 4000 characters'),
});

/** GET /channels/:channelId/messages */
export async function list(req: Request, res: Response): Promise<void> {
  const { before, limit } = pageSchema.parse(req.query);
  res.json(await messageService.getMessages(channelIdSchema.parse(req.params.channelId), limit, before));
}

/** POST /channels/:channelId/messages */
export async function create(req: Request, res: Response): Promise<void> {
  const { content } = postSchema.parse(req.body);
  const channelId = channelIdSchema.parse(req.params.channelId);
  res.status(201).json(await messageService.postMessage(channelId, currentUser(req), content));
}
