import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import { requireOwner } from '../services/accessService.js';
import * as inviteService from '../services/inviteService.js';
import { inviteCodeSchema } from './schemas.js';

const codeSchema = z.object({ code: inviteCodeSchema });

/** POST /invites/redeem */
export async function redeem(req: Request, res: Response): Promise<void> {
  await inviteService.redeemCode(currentUser(req).id, codeSchema.parse(req.body).code);
  res.status(204).end();
}

/** POST /invites/revoke */
export async function revoke(req: Request, res: Response): Promise<void> {
  await requireOwner(currentUser(req).id);
  await inviteService.revokeCode(codeSchema.parse(req.body).code);
  res.status(204).end();
}
