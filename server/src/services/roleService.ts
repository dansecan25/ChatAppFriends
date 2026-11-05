import { findChannelById, setChannelRoles, flagRotation, type Channel } from '../models/channelModel.js';
import {
  deleteRole,
  findRoleById,
  insertRole,
  listMemberRoleIds,
  listRoles,
  setMemberRoles,
  updateRole as updateRoleRow,
  type Role,
} from '../models/roleModel.js';
import { findServerById, setEveryonePermissions } from '../models/serverModel.js';
import { HttpError } from '../utils/httpError.js';
import { ADMINISTRATOR, covers, toPermissionBits, toPermissionNames, type Permission } from '../utils/permissions.js';
import { requirePermission, restrictedAudiences } from './accessService.js';
import { emitToServer, emitToUsers } from './realtimeService.js';
import { removeUserFromVoiceChannel } from './voiceService.js';

/** Makes a change that can alter who sees restricted channels, then acts on the difference. */
export async function applyAccessChange(serverId: number, change: () => Promise<void>): Promise<void> {
  const before = await restrictedAudiences(serverId);
  await change();
  const after = await restrictedAudiences(serverId);

  const rotations: number[] = [];
  const affected = new Set<number>();
  for (const [channelId, audience] of after) {
    const previous = before.get(channelId) ?? new Set<number>();
    const lost = [...previous].filter((id) => !audience.has(id));
    const gained = [...audience].filter((id) => !previous.has(id));
    if (lost.length > 0) rotations.push(channelId);
    lost.forEach((id) => removeUserFromVoiceChannel(channelId, id));
    [...lost, ...gained].forEach((id) => affected.add(id));
  }
  await flagRotation(rotations);
  emitToUsers([...affected], 'access:changed', { serverId });
  emitToServer(serverId, 'keys:needed', { serverId });
}

const toRoleDto = (role: Role) => ({
  id: role.id,
  serverId: role.serverId,
  name: role.name,
  isAdmin: role.isAdmin,
  permissions: toPermissionNames(role.permissions),
});

const announceRoles = (serverId: number) => emitToServer(serverId, 'roles:changed', { serverId });

/** Nobody can hand out, take away or edit a permission they don't have themselves. */
function requireCovers(actor: number, target: number): void {
  if (!covers(actor, target)) throw new HttpError(403, 'You can only manage permissions you have yourself');
}

const rethrowDuplicate = (err: unknown): never => {
  if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A role with that name exists');
  throw err;
};

const requireRoleInServer = async (roleId: number, serverId: number): Promise<Role> => {
  const role = await findRoleById(roleId);
  if (!role || role.serverId !== serverId) throw new HttpError(404, 'Role not found');
  return role;
};

const requireRolesInServer = (roleIds: number[], serverId: number): Promise<Role[]> =>
  Promise.all(roleIds.map((roleId) => requireRoleInServer(roleId, serverId)));

/** Lists a server's roles and what every member can do. */
export async function getRoles(serverId: number) {
  const [server, roles] = await Promise.all([findServerById(serverId), listRoles(serverId)]);
  return { everyone: toPermissionNames(server?.everyonePermissions ?? 0), roles: roles.map(toRoleDto) };
}

/** Creates a role with permissions its creator has. */
export async function createRole(serverId: number, actorId: number, name: string, permissions: Permission[]) {
  const actor = await requirePermission(serverId, actorId, 'manageRoles');
  const bits = toPermissionBits(permissions);
  requireCovers(actor, bits);
  const role = await insertRole(serverId, name, bits).catch(rethrowDuplicate);
  announceRoles(serverId);
  return toRoleDto(role);
}

/** Renames a role or changes its permissions. The Admin role always keeps every permission. */
export async function updateRole(
  serverId: number,
  actorId: number,
  roleId: number,
  change: { name?: string; permissions?: Permission[] },
): Promise<void> {
  const actor = await requirePermission(serverId, actorId, 'manageRoles');
  const role = await requireRoleInServer(roleId, serverId);
  const bits = change.permissions ? toPermissionBits(change.permissions) : role.permissions;
  requireCovers(actor, role.permissions);
  requireCovers(actor, bits);
  if (role.isAdmin && (bits & ADMINISTRATOR) === 0) throw new HttpError(400, 'The Admin role always has every permission');
  await updateRoleRow(roleId, change.name ?? role.name, bits).catch(rethrowDuplicate);
  announceRoles(serverId);
}

/** Changes what every member can do before roles. */
export async function updateEveryonePermissions(serverId: number, actorId: number, permissions: Permission[]): Promise<void> {
  const actor = await requirePermission(serverId, actorId, 'manageRoles');
  const bits = toPermissionBits(permissions);
  requireCovers(actor, (await findServerById(serverId))?.everyonePermissions ?? 0);
  requireCovers(actor, bits);
  await setEveryonePermissions(serverId, bits);
  announceRoles(serverId);
}

/** Deletes a role. The built-in Admin role stays. */
export async function removeRole(serverId: number, actorId: number, roleId: number): Promise<void> {
  const actor = await requirePermission(serverId, actorId, 'manageRoles');
  const role = await requireRoleInServer(roleId, serverId);
  if (role.isAdmin) throw new HttpError(400, 'The admin role cannot be deleted');
  requireCovers(actor, role.permissions);
  await applyAccessChange(serverId, () => deleteRole(roleId));
  announceRoles(serverId);
}

/** Replaces a member's roles. Only roles within the actor's own permissions can be given or taken away. */
export async function assignRoles(serverId: number, actorId: number, userId: number, roleIds: number[]): Promise<void> {
  const actor = await requirePermission(serverId, actorId, 'manageRoles');
  const current = (await listMemberRoleIds(serverId)).get(userId) ?? [];
  const wanted = [...new Set(roleIds)];
  const changed = [...wanted.filter((id) => !current.includes(id)), ...current.filter((id) => !wanted.includes(id))];
  (await requireRolesInServer(changed, serverId)).forEach((role) => requireCovers(actor, role.permissions));
  await applyAccessChange(serverId, () => setMemberRoles(serverId, userId, wanted));
  announceRoles(serverId);
}

/** Replaces the roles allowed in a restricted channel. Open channels stay open, because everyone has their key. */
export async function updateChannelRoles(channel: Channel, roleIds: number[]): Promise<Channel> {
  if (!channel.restricted) throw new HttpError(400, 'Only restricted channels have roles');
  await requireRolesInServer(roleIds, channel.serverId);
  await applyAccessChange(channel.serverId, () => setChannelRoles(channel.id, roleIds));
  return (await findChannelById(channel.id)) as Channel;
}
