import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import { requireMember } from '../services/accessService.js';
import * as roleService from '../services/roleService.js';
import * as serverService from '../services/serverService.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { idSchema } from './schemas.js';

const nameSchema = z.string().trim().min(1, 'Enter a server name').max(50, 'Server names can have up to 50 characters');
const renameSchema = z.object({ name: nameSchema });
const roleNameSchema = z.string().trim().min(1, 'Enter a role name').max(32, 'Role names can have up to 32 characters');
const permissionsSchema = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);
const roleSchema = z.object({ name: roleNameSchema, permissions: permissionsSchema.default([]) });
const roleChangeSchema = z.object({ name: roleNameSchema.optional(), permissions: permissionsSchema.optional() });
const everyoneSchema = z.object({ permissions: permissionsSchema });
const memberRolesSchema = z.object({ roleIds: z.array(z.number().int().positive()).max(50) });

const serverIdOf = (req: Request) => idSchema.parse(req.params.serverId);

/** GET /servers */
export async function list(req: Request, res: Response): Promise<void> {
  res.json(await serverService.getServersForUser(currentUser(req).id));
}

/** PATCH /servers/:serverId */
export async function rename(req: Request, res: Response): Promise<void> {
  await serverService.rename(serverIdOf(req), currentUser(req).id, renameSchema.parse(req.body).name);
  res.status(204).end();
}

/** GET /servers/:serverId/members */
export async function members(req: Request, res: Response): Promise<void> {
  const serverId = serverIdOf(req);
  await requireMember(serverId, currentUser(req).id);
  res.json(await serverService.getMembers(serverId));
}

/** DELETE /servers/:serverId/members/:userId */
export async function removeMember(req: Request, res: Response): Promise<void> {
  const serverId = serverIdOf(req);
  const userId = idSchema.parse(req.params.userId);
  await requireMember(serverId, userId);
  await serverService.removeMember(serverId, userId, currentUser(req).id);
  res.status(204).end();
}

/** GET /servers/:serverId/roles */
export async function roles(req: Request, res: Response): Promise<void> {
  const serverId = serverIdOf(req);
  await requireMember(serverId, currentUser(req).id);
  res.json(await roleService.getRoles(serverId));
}

/** POST /servers/:serverId/roles */
export async function createRole(req: Request, res: Response): Promise<void> {
  const { name, permissions } = roleSchema.parse(req.body);
  res.status(201).json(await roleService.createRole(serverIdOf(req), currentUser(req).id, name, permissions));
}

/** PATCH /servers/:serverId/roles/:roleId */
export async function updateRole(req: Request, res: Response): Promise<void> {
  const roleId = idSchema.parse(req.params.roleId);
  await roleService.updateRole(serverIdOf(req), currentUser(req).id, roleId, roleChangeSchema.parse(req.body));
  res.status(204).end();
}

/** PUT /servers/:serverId/everyone */
export async function setEveryone(req: Request, res: Response): Promise<void> {
  const { permissions } = everyoneSchema.parse(req.body);
  await roleService.updateEveryonePermissions(serverIdOf(req), currentUser(req).id, permissions);
  res.status(204).end();
}

/** DELETE /servers/:serverId/roles/:roleId */
export async function deleteRole(req: Request, res: Response): Promise<void> {
  await roleService.removeRole(serverIdOf(req), currentUser(req).id, idSchema.parse(req.params.roleId));
  res.status(204).end();
}

/** PUT /servers/:serverId/members/:userId/roles */
export async function setMemberRoles(req: Request, res: Response): Promise<void> {
  const serverId = serverIdOf(req);
  const userId = idSchema.parse(req.params.userId);
  await requireMember(serverId, userId);
  await roleService.assignRoles(serverId, currentUser(req).id, userId, memberRolesSchema.parse(req.body).roleIds);
  res.status(204).end();
}
