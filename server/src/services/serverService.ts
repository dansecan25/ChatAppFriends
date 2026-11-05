import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { insertChannel, listChannels } from '../models/channelModel.js';
import { listMemberRoleIds } from '../models/roleModel.js';
import {
  deleteMember,
  findServerById,
  findServerBySlot,
  insertOwnerMembership,
  insertRootKey,
  insertServer,
  listMemberIds,
  listNicknames,
  listRootKeys,
  listServersForUser,
  renameServer,
} from '../models/serverModel.js';
import { findOwnerId, findUserById, findUsersByIds } from '../models/userModel.js';
import { SERVER_DEFINITIONS } from '../serverDefinitions.js';
import { decryptField, encryptField } from '../utils/fieldCrypto.js';
import { HttpError } from '../utils/httpError.js';
import { covers } from '../utils/permissions.js';
import { permissionsOf, requirePermission } from './accessService.js';
import { isOnline } from './presenceService.js';
import { emitToServer, emitToUsers, unsubscribeUserFromServer } from './realtimeService.js';
import { applyAccessChange } from './roleService.js';
import { removeUserFromVoiceChannel } from './voiceService.js';

const ROOT_KEY_BYTES = 32;

const storeNewRootKey = (serverId: number, version: number) =>
  insertRootKey(serverId, version, encryptField(randomBytes(ROOT_KEY_BYTES).toString('base64')));

/** Creates any server newly added to the list, with its key and starter channels, and adds the owner to it. */
export async function syncDefinedServers(): Promise<void> {
  if (config.INVITE_CODE.length !== SERVER_DEFINITIONS.length) {
    throw new Error(
      `INVITE_CODE has ${config.INVITE_CODE.length} codes but serverDefinitions.ts lists ` +
        `${SERVER_DEFINITIONS.length} servers. Each code needs a server, in the same order.`,
    );
  }
  const ownerId = await findOwnerId();
  for (const [slot, { name }] of SERVER_DEFINITIONS.entries()) {
    const existing = await findServerBySlot(slot);
    const serverId = existing?.id ?? (await insertServer(slot, name));
    if (!existing) {
      await insertChannel(serverId, 'general', 'text', null);
      await insertChannel(serverId, 'General', 'voice', null);
    }
    if ((await listRootKeys(serverId)).length === 0) await storeNewRootKey(serverId, 0);
    if (ownerId !== null) await insertOwnerMembership(serverId, ownerId);
  }
}

/** Lists a user's servers, with the keys for their open channels. Only members ever receive these. */
export async function getServersForUser(userId: number) {
  const servers = await listServersForUser(userId);
  return Promise.all(
    servers.map(async (server) => ({
      id: server.id,
      name: server.name,
      rootKeyVersion: server.rootKeyVersion,
      rootKeys: (await listRootKeys(server.id)).map(({ version, keyEnc }) => ({ version, key: decryptField(keyEnc) })),
    })),
  );
}

/** Renames a server for everyone in it. */
export async function rename(serverId: number, actorId: number, name: string): Promise<void> {
  await requirePermission(serverId, actorId, 'manageServer');
  await renameServer(serverId, name);
  emitToServer(serverId, 'server:renamed', { id: serverId, name });
}

/** Lists a server's members with what others need to share keys with them. */
export async function getMembers(serverId: number) {
  const [ids, roles, nicknames] = await Promise.all([
    listMemberIds(serverId),
    listMemberRoleIds(serverId),
    listNicknames(serverId),
  ]);
  const users = await findUsersByIds(ids);
  return ids.flatMap((id) => {
    const user = users.get(id);
    return user
      ? [
          {
            id,
            username: user.username,
            nickname: nicknames.get(id) ?? null,
            avatarId: user.avatarId,
            publicKey: user.publicKey,
            isOwner: user.isOwner,
            roleIds: roles.get(id) ?? [],
            online: isOnline(id),
          },
        ]
      : [];
  });
}

/**
 * Removes someone from a server and replaces its key, so they can't read new messages.
 * Their code keeps working for them until it's revoked and replaced in INVITE_CODE.
 */
export async function removeMember(serverId: number, targetId: number, actorId: number): Promise<void> {
  const actor = await requirePermission(serverId, actorId, 'removeMembers');
  if (targetId === actorId) throw new HttpError(400, 'You cannot remove yourself');
  if ((await findUserById(targetId))?.isOwner) throw new HttpError(403, 'The owner cannot be removed');
  if (!covers(actor, await permissionsOf(serverId, targetId))) {
    throw new HttpError(403, "You can't remove someone with permissions you don't have");
  }

  unsubscribeUserFromServer(targetId, serverId);
  const server = await findServerById(serverId);
  await storeNewRootKey(serverId, (server?.rootKeyVersion ?? 0) + 1);
  await applyAccessChange(serverId, () => deleteMember(serverId, targetId));
  for (const channel of await listChannels(serverId)) removeUserFromVoiceChannel(channel.id, targetId);

  emitToUsers([targetId], 'member:removed', { serverId });
  emitToServer(serverId, 'server:keyChanged', { serverId });
  emitToServer(serverId, 'roles:changed', { serverId });
}
