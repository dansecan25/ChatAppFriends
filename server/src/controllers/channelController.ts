import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import * as channelService from '../services/channelService.js';

export const channelIdSchema = z.coerce.number().int().positive();

const createSchema = z.object({
  name: z.string().trim().min(1, 'Enter a channel name').max(50, 'Channel names can have up to 50 characters'),
  type: z.enum(['text', 'voice']),
});

/** GET /channels */
export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await channelService.listChannels());
}

/** POST /channels */
export async function create(req: Request, res: Response): Promise<void> {
  const { name, type } = createSchema.parse(req.body);
  res.status(201).json(await channelService.createChannel(name, type, currentUser(req).id));
}

/** DELETE /channels/:channelId */
export async function remove(req: Request, res: Response): Promise<void> {
  await channelService.deleteChannel(channelIdSchema.parse(req.params.channelId), currentUser(req).id);
  res.status(204).end();
}
