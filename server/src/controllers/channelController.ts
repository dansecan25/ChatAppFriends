import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import { requireMember, requirePermission } from '../services/accessService.js';
import * as channelService from '../services/channelService.js';
import * as roleService from '../services/roleService.js';
import { envelopesSchema, idSchema } from './schemas.js';

const roleIdsSchema = z.array(z.number().int().positive()).max(50);

const nameSchema = z.string().trim().min(1, 'Enter a channel name').max(50, 'Channel names can have up to 50 characters');
const createSchema = z.object({
  name: nameSchema,
  type: z.enum(['text', 'voice']),
  roleIds: roleIdsSchema.default([]),
  envelopes: envelopesSchema.default([]),
});
const renameSchema = z.object({ name: nameSchema });
const rolesSchema = z.object({ roleIds: roleIdsSchema.min(1, 'Choose at least one role') });
const shareSchema = z.object({ envelopes: envelopesSchema });
const rotateSchema = z.object({ version: z.number().int().positive(), envelopes: envelopesSchema });

const channelIdOf = (req: Request) => idSchema.parse(req.params.channelId);

/** GET /servers/:serverId/channels */
export async function list(req: Request, res: Response): Promise<void> {
  const serverId = idSchema.parse(req.params.serverId);
  const userId = currentUser(req).id;
  await requireMember(serverId, userId);
  res.json(await channelService.getVisibleChannels(serverId, userId));
}

/** POST /servers/:serverId/channels */
export async function create(req: Request, res: Response): Promise<void> {
  const serverId = idSchema.parse(req.params.serverId);
  const userId = currentUser(req).id;
  await requirePermission(serverId, userId, 'createChannels', 'manageChannels');
  const { name, type, roleIds, envelopes } = createSchema.parse(req.body);
  res.status(201).json(await channelService.createChannel(serverId, name, type, userId, roleIds, envelopes));
}

/** PATCH /channels/:channelId */
export async function rename(req: Request, res: Response): Promise<void> {
  res.json(await channelService.renameChannel(channelIdOf(req), currentUser(req).id, renameSchema.parse(req.body).name));
}

/** DELETE /channels/:channelId */
export async function remove(req: Request, res: Response): Promise<void> {
  await channelService.deleteChannel(channelIdOf(req), currentUser(req).id);
  res.status(204).end();
}

/** PUT /channels/:channelId/roles */
export async function setRoles(req: Request, res: Response): Promise<void> {
  const channel = await channelService.requireChannelManager(channelIdOf(req), currentUser(req).id);
  res.json(await roleService.updateChannelRoles(channel, rolesSchema.parse(req.body).roleIds));
}

/** GET /channels/:channelId/keys */
export async function keys(req: Request, res: Response): Promise<void> {
  res.json(await channelService.getChannelKeys(channelIdOf(req), currentUser(req).id));
}

/** POST /channels/:channelId/keys */
export async function shareKeys(req: Request, res: Response): Promise<void> {
  await channelService.shareChannelKeys(channelIdOf(req), currentUser(req).id, shareSchema.parse(req.body).envelopes);
  res.status(204).end();
}

/** POST /channels/:channelId/rotate */
export async function rotate(req: Request, res: Response): Promise<void> {
  const { version, envelopes } = rotateSchema.parse(req.body);
  await channelService.rotateChannelKey(channelIdOf(req), currentUser(req).id, version, envelopes);
  res.status(204).end();
}

/** GET /servers/:serverId/key-work */
export async function keyWork(req: Request, res: Response): Promise<void> {
  const serverId = idSchema.parse(req.params.serverId);
  const userId = currentUser(req).id;
  await requireMember(serverId, userId);
  res.json(await channelService.getKeyWork(serverId, userId));
}

