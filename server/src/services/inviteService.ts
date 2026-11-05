import { config } from '../config.js';
import {
  findServerBySlot,
  insertMemberWithinLimit,
  insertOwnerMembership,
  insertRevokedCode,
  isCodeRevoked,
  isMember,
  listAllServerIds,
} from '../models/serverModel.js';
import { claimOwnership } from '../models/userModel.js';
import { sha256Hex } from '../utils/fieldCrypto.js';
import { HttpError } from '../utils/httpError.js';
import { subscribeUserToServer } from './realtimeService.js';

export type ResolvedCode = { kind: 'master' } | { kind: 'server'; serverId: number };

const INVALID_CODE = 'Invalid invite code';

const matches = (code: string, candidate: string) => sha256Hex(code) === sha256Hex(candidate);

/** Works out what a code unlocks: its position in INVITE_CODE picks the server. Blacklisted codes unlock nothing. */
export async function requireCode(code: string): Promise<ResolvedCode> {
  if (matches(code, config.MASTER_INVITE_CODE)) return { kind: 'master' };
  const slot = config.INVITE_CODE.findIndex((candidate) => matches(code, candidate));
  const server = slot === -1 || (await isCodeRevoked(sha256Hex(code))) ? null : await findServerBySlot(slot);
  if (!server) throw new HttpError(403, INVALID_CODE);
  return { kind: 'server', serverId: server.id };
}

/** Applies a code to a user: the master code claims ownership of everything, and others join their server. */
export async function applyCode(resolved: ResolvedCode, userId: number): Promise<void> {
  if (resolved.kind === 'master') {
    if (!(await claimOwnership(userId))) throw new HttpError(403, INVALID_CODE);
    for (const serverId of await listAllServerIds()) {
      await insertOwnerMembership(serverId, userId);
      subscribeUserToServer(userId, serverId);
    }
    return;
  }
  const { serverId } = resolved;
  if (await isMember(serverId, userId)) return;
  if (!(await insertMemberWithinLimit(serverId, userId, config.MAX_USERS))) {
    throw new HttpError(403, `This server is full (${config.MAX_USERS} members)`);
  }
  subscribeUserToServer(userId, serverId);
}

/** Joins another server while signed in. */
export async function redeemCode(userId: number, code: string): Promise<void> {
  await applyCode(await requireCode(code), userId);
}

/** Blacklists a code, so nobody new can use it. Accounts already created with it keep their access. */
export async function revokeCode(code: string): Promise<void> {
  if (matches(code, config.MASTER_INVITE_CODE)) throw new HttpError(400, 'The master code cannot be revoked');
  await insertRevokedCode(sha256Hex(code));
}
