import * as channelApi from '@/api/channelApi';
import * as serverApi from '@/api/serverApi';
import { memberHasAccess } from '@/stores/channelStore';
import type { Channel } from '@/types/models';
import type { KeyEnvelopeDto, MemberDto } from '@/types/dto';
import { channelKeyEntry, forgetChannelKeys, wrapForMember } from './crypto/keyring';
import { newSymmetricKey } from './crypto/primitives';

let running = Promise.resolve();

/** Shares this browser's channel keys with newly allowed members. */
async function shareKeys(grants: { channelId: number; version: number; userId: number }[], members: MemberDto[]) {
  const channelIds = [...new Set(grants.map((grant) => grant.channelId))];
  for (const channelId of channelIds) {
    const { byVersion } = await channelKeyEntry(channelId);
    const envelopes: KeyEnvelopeDto[] = [];
    for (const { version, userId } of grants.filter((grant) => grant.channelId === channelId)) {
      const raw = byVersion.get(version);
      const member = members.find((candidate) => candidate.id === userId);
      if (raw && member) envelopes.push({ version, userId, wrappedKey: await wrapForMember(raw, member) });
    }
    if (envelopes.length > 0) await channelApi.shareChannelKeys(channelId, envelopes);
  }
}

/** Replaces a channel's key after someone lost access, so they can't read what comes next. */
async function rotateKey(channel: Channel, members: MemberDto[]) {
  const raw = newSymmetricKey();
  const version = channel.keyVersion + 1;
  const audience = members.filter((member) => memberHasAccess(channel, member));
  const envelopes = await Promise.all(
    audience.map(async (member) => ({ version, userId: member.id, wrappedKey: await wrapForMember(raw, member) })),
  );
  await channelApi.rotateChannelKey(channel.id, version, envelopes).catch((err) => {
    if (err?.status !== 409) throw err;
  });
  forgetChannelKeys(channel.id);
}

async function doKeyWork(serverId: number): Promise<void> {
  const { grants, rotations } = await channelApi.fetchKeyWork(serverId);
  if (grants.length === 0 && rotations.length === 0) return;
  const [members, channels] = await Promise.all([serverApi.fetchMembers(serverId), channelApi.fetchChannels(serverId)]);
  for (const channelId of rotations) {
    const channel = channels.find((candidate) => candidate.id === channelId);
    if (channel) await rotateKey(channel, members);
  }
  await shareKeys(grants, members);
}

/** Does the key sharing only a member's browser can do, one run at a time. */
export function runKeyWork(serverId: number): Promise<void> {
  running = running.catch(() => undefined).then(() => doKeyWork(serverId));
  return running;
}
