import { findChannelById, flagRotation, setChannelRoles, type Channel } from '../models/channelModel.js';
import { deleteRole, findRoleById, insertRole, listRoles, setMemberRoles, type Role } from '../models/roleModel.js';
import { HttpError } from '../utils/httpError.js';
import { restrictedAudiences } from './accessService.js';
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

const requireRoleInServer = async (roleId: number, serverId: number): Promise<Role> => {
  const role = await findRoleById(roleId);
  if (!role || role.serverId !== serverId) throw new HttpError(404, 'Role not found');
  return role;
};

const requireRolesInServer = async (roleIds: number[], serverId: number): Promise<void> => {
  await Promise.all(roleIds.map((roleId) => requireRoleInServer(roleId, serverId)));
};

/** Lists a server's roles. */
export const getRoles = listRoles;

/** Creates a role. */
export async function createRole(serverId: number, name: string): Promise<Role> {
  try {
    const role = await insertRole(serverId, name);
    emitToServer(serverId, 'roles:changed', { serverId });
    return role;
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new HttpError(409, 'A role with that name exists');
    throw err;
  }
}

/** Deletes a role. The built-in admin role stays. */
export async function removeRole(serverId: number, roleId: number): Promise<void> {
  const role = await requireRoleInServer(roleId, serverId);
  if (role.isAdmin) throw new HttpError(400, 'The admin role cannot be deleted');
  await applyAccessChange(serverId, () => deleteRole(roleId));
  emitToServer(serverId, 'roles:changed', { serverId });
}

/** Replaces a member's roles. */
export async function assignRoles(serverId: number, userId: number, roleIds: number[]): Promise<void> {
  await requireRolesInServer(roleIds, serverId);
  await applyAccessChange(serverId, () => setMemberRoles(serverId, userId, roleIds));
  emitToServer(serverId, 'roles:changed', { serverId });
}

/** Replaces the roles allowed in a restricted channel. Open channels stay open, because everyone has their key. */
export async function updateChannelRoles(channel: Channel, roleIds: number[]): Promise<Channel> {
  if (!channel.restricted) throw new HttpError(400, 'Only restricted channels have roles');
  await requireRolesInServer(roleIds, channel.serverId);
  await applyAccessChange(channel.serverId, () => setChannelRoles(channel.id, roleIds));
  return (await findChannelById(channel.id)) as Channel;
}
