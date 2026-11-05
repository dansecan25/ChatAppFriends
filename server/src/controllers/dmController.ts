import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import * as dmService from '../services/dmService.js';
import { opaqueSchema } from './schemas.js';

const openSchema = z.object({
  userId: z.number().int().positive(),
  wrappedKeySelf: opaqueSchema,
  wrappedKeyOther: opaqueSchema,
});

/** GET /dms */
export async function list(req: Request, res: Response): Promise<void> {
  res.json(await dmService.getDms(currentUser(req).id));
}

/** POST /dms */
export async function open(req: Request, res: Response): Promise<void> {
  const { userId, wrappedKeySelf, wrappedKeyOther } = openSchema.parse(req.body);
  res.status(201).json(await dmService.openDm(currentUser(req).id, userId, wrappedKeySelf, wrappedKeyOther));
}
