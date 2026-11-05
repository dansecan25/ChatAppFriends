import * as channelApi from '@/api/channelApi';
import * as serverApi from '@/api/serverApi';
import { deriveSubkey, fromBase64, toAesKey, unwrapFromUser, wrapForUser, type Bytes } from './primitives';
import { assertPinnedKey, requireIdentity } from './identity';

/** Where a message lives. Each thread has its own keys. */
export type Thread = { kind: 'channel'; id: number; serverId: number; restricted: boolean } | { kind: 'dm'; id: number };

export const threadKeyOf = (thread: { kind: 'channel' | 'dm'; id: number }): string =>
  `${thread.kind === 'channel' ? 'c' : 'd'}${thread.id}`;

const rootKeys = new Map<number, { current: number; byVersion: Map<number, Bytes> }>();
const dmKeys = new Map<number, CryptoKey>();
const channelKeys = new Map<number, { current: number; byVersion: Map<number, Bytes> }>();

const unwrap = (wrapped: string): Promise<Bytes> => {
  const { privateKey, publicKey } = requireIdentity();
  return unwrapFromUser(wrapped, privateKey, publicKey);
};

/** Wraps a key for another member, refusing if their key differs from the one seen before. */
export async function wrapForMember(
  raw: Bytes,
  member: { id: number; username: string; publicKey: string | null },
): Promise<string> {
  if (!member.publicKey) throw new Error(`${member.username} has not set up encryption yet`);
  await assertPinnedKey(member.id, member.username, member.publicKey);
  return wrapForUser(raw, member.publicKey);
}

export const wrapForSelf = (raw: Bytes): Promise<string> => wrapForUser(raw, requireIdentity().publicKey);

/** Caches every version of a server's key. */
export function loadRootKeys(serverId: number, current: number, keys: { version: number; key: string }[]): void {
  rootKeys.set(serverId, { current, byVersion: new Map(keys.map(({ version, key }) => [version, fromBase64(key)])) });
}

/** Fetches a server's keys again, after they changed. */
export async function refreshRootKeys(serverId: number): Promise<void> {
  const server = (await serverApi.fetchServers()).find((candidate) => candidate.id === serverId);
  if (server) loadRootKeys(serverId, server.rootKeyVersion, server.rootKeys);
}

/** Returns a server's unlocked keys. */
export function requireRootKeys(serverId: number): { current: number; byVersion: Map<number, Bytes> } {
  const keys = rootKeys.get(serverId);
  if (!keys) throw new Error('This server is still locked');
  return keys;
}

/** Unlocks and caches a DM conversation's key. */
export async function loadDmKey(dmId: number, wrapped: string): Promise<void> {
  if (!dmKeys.has(dmId)) dmKeys.set(dmId, await toAesKey(await unwrap(wrapped)));
}

/** Loads this user's copies of a restricted channel's keys. */
async function loadChannelKeys(channelId: number) {
  const { keyVersion, envelopes } = await channelApi.fetchChannelKeys(channelId);
  const byVersion = new Map<number, Bytes>();
  await Promise.all(envelopes.map(async (e) => byVersion.set(e.version, await unwrap(e.wrappedKey))));
  const entry = { current: keyVersion, byVersion };
  channelKeys.set(channelId, entry);
  return entry;
}

/** Forgets a channel's cached keys, so the next use fetches any new ones. */
export const forgetChannelKeys = (channelId: number): void => void channelKeys.delete(channelId);

/** Returns the raw keys held for a restricted channel. */
export const channelKeyEntry = async (channelId: number) =>
  channelKeys.get(channelId) ?? loadChannelKeys(channelId);

const WAITING_FOR_KEY = 'Waiting for someone with access to come online and share this channel\'s key';

/** Returns the key to read a message in a thread at a key version. */
export async function readKey(thread: Thread, version: number): Promise<CryptoKey> {
  if (thread.kind === 'dm') {
    const key = dmKeys.get(thread.id);
    if (!key) throw new Error('This conversation is still locked');
    return key;
  }
  if (!thread.restricted) {
    if (!requireRootKeys(thread.serverId).byVersion.has(version)) await refreshRootKeys(thread.serverId);
    const root = requireRootKeys(thread.serverId).byVersion.get(version);
    if (!root) throw new Error('This message was sent before you could read this server');
    return deriveSubkey(root, `channel:${thread.id}:${version}`);
  }
  let raw = (await channelKeyEntry(thread.id)).byVersion.get(version);
  if (!raw) {
    forgetChannelKeys(thread.id);
    raw = (await channelKeyEntry(thread.id)).byVersion.get(version);
  }
  if (!raw) throw new Error(WAITING_FOR_KEY);
  return toAesKey(raw);
}

/** Returns the key and version for sending a new message in a thread. */
export async function writeKey(thread: Thread): Promise<{ key: CryptoKey; version: number }> {
  if (thread.kind === 'channel' && thread.restricted) {
    const version = (await channelKeyEntry(thread.id)).current;
    return { key: await readKey(thread, version), version };
  }
  const version = thread.kind === 'channel' ? requireRootKeys(thread.serverId).current : 0;
  return { key: await readKey(thread, version), version };
}

/** Forgets every key held in memory, on sign-out. */
export function clearKeyring(): void {
  rootKeys.clear();
  dmKeys.clear();
  channelKeys.clear();
}
