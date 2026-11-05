import { findChannelById, listChannels, type Channel } from '../models/channelModel.js';
import { findDmById, type DmConversation } from '../models/dmModel.js';
import type { MessageScope } from '../models/messageModel.js';
import { listMemberRoleIds, memberRolePermissions } from '../models/roleModel.js';
import { findServerById, isMember, listMemberIds } from '../models/serverModel.js';
import { findUserById } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { ALL_PERMISSIONS, expandAdministrator, permissionBit, type Permission } from '../utils/permissions.js';

/** Requires the signed-in user to be the app's owner. */
export async function requireOwner(userId: number): Promise<void> {
  if (!(await findUserById(userId))?.isOwner) throw new HttpError(403, 'Only the owner can do this');
}

/** Requires membership. Reports the server as missing so outsiders can't learn that it exists. */
export async function requireMember(serverId: number, userId: number): Promise<void> {
  if (!(await isMember(serverId, userId))) throw new HttpError(404, 'Server not found');
}

/**
 * Returns what someone may do in a server, as permission bits: what everyone can do plus their roles'.
 * The owner may do everything. Callers check membership first.
 */
export async function permissionsOf(serverId: number, userId: number): Promise<number> {
  const [user, server, roleBits] = await Promise.all([
    findUserById(userId),
    findServerById(serverId),
    memberRolePermissions(serverId, userId),
  ]);
  if (user?.isOwner) return ALL_PERMISSIONS;
  return expandAdministrator((server?.everyonePermissions ?? 0) | roleBits);
}

/** Tells whether a member has a permission. */
export async function hasPermission(serverId: number, userId: number, permission: Permission): Promise<boolean> {
  return ((await permissionsOf(serverId, userId)) & permissionBit(permission)) !== 0;
}

/** Requires a member with any of the given permissions, and returns all of theirs. */
export async function requirePermission(serverId: number, userId: number, ...permissions: Permission[]): Promise<number> {
  await requireMember(serverId, userId);
  const bits = await permissionsOf(serverId, userId);
  if (!permissions.some((permission) => (bits & permissionBit(permission)) !== 0)) {
    throw new HttpError(403, "You don't have permission to do this");
  }
  return bits;
}

/** Works out who may use a channel, given each member's roles. */
function audienceFromRoles(channel: Channel, memberIds: number[], memberRoles: Map<number, number[]>): number[] {
  if (!channel.restricted) return memberIds;
  return memberIds.filter(
    (id) =>
      id === channel.createdBy || (memberRoles.get(id) ?? []).some((roleId) => channel.roleIds.includes(roleId)),
  );
}

/** Returns the ids of everyone who may use a channel. The owner gets no exception for restricted channels. */
export async function channelAudience(channel: Channel): Promise<number[]> {
  const [memberIds, memberRoles] = await Promise.all([
    listMemberIds(channel.serverId),
    listMemberRoleIds(channel.serverId),
  ]);
  return audienceFromRoles(channel, memberIds, memberRoles);
}

/** Returns each restricted channel's audience in a server. */
export async function restrictedAudiences(serverId: number): Promise<Map<number, Set<number>>> {
  const [channels, memberIds, memberRoles] = await Promise.all([
    listChannels(serverId),
    listMemberIds(serverId),
    listMemberRoleIds(serverId),
  ]);
  return new Map(
    channels
      .filter((channel) => channel.restricted)
      .map((channel) => [channel.id, new Set(audienceFromRoles(channel, memberIds, memberRoles))]),
  );
}

/** Returns a channel the user may use. Hidden channels look missing. */
export async function requireChannelAccess(channelId: number, userId: number): Promise<Channel> {
  const channel = await findChannelById(channelId);
  if (!channel || !(await channelAudience(channel)).includes(userId)) throw new HttpError(404, 'Channel not found');
  return channel;
}

/** Returns a DM conversation the user is part of. */
export async function requireDmAccess(dmId: number, userId: number): Promise<DmConversation> {
  const dm = await findDmById(dmId);
  if (!dm || (dm.userLow !== userId && dm.userHigh !== userId)) throw new HttpError(404, 'Conversation not found');
  return dm;
}

/** Requires access to wherever a message lives. */
export async function requireScopeAccess(scope: MessageScope, userId: number): Promise<void> {
  if ('channelId' in scope) {
    const channel = await requireChannelAccess(scope.channelId, userId);
    if (channel.type !== 'text') throw new HttpError(404, 'Channel not found');
  } else {
    await requireDmAccess(scope.dmId, userId);
  }
}
