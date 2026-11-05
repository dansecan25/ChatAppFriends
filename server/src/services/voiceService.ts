import type { types } from 'mediasoup';
import { config } from '../config.js';
import { getMediaEngine } from '../connections/mediasoup.js';
import { getIo } from '../connections/socket.js';
import { findChannelById } from '../models/channelModel.js';
import type { AuthUser } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import { channelAudience, requireChannelAccess } from './accessService.js';
import { emitToUsers } from './realtimeService.js';

export type TransportDirection = 'send' | 'recv';

export interface VoiceParticipant {
  userId: number;
  username: string;
  muted: boolean;
  deafened: boolean;
}

interface Peer {
  socketId: string;
  user: AuthUser;
  channelId: number;
  muted: boolean;
  deafened: boolean;
  transports: Partial<Record<TransportDirection, types.WebRtcTransport>>;
  producer?: types.Producer;
  consumers: Map<string, types.Consumer>;
}

const peers = new Map<string, Peer>();
const speakingByChannel = new Map<number, string>();

const roomName = (channelId: number) => `voice:${channelId}`;
const peersInChannel = (channelId: number) => [...peers.values()].filter((peer) => peer.channelId === channelId);

const requirePeer = (socketId: string): Peer => {
  const peer = peers.get(socketId);
  if (!peer) throw new HttpError(409, 'You are not in a voice channel');
  return peer;
};

const requireTransport = (peer: Peer, transportId: string): types.WebRtcTransport => {
  const transport = Object.values(peer.transports).find((candidate) => candidate.id === transportId);
  if (!transport) throw new HttpError(404, 'Voice transport not found');
  return transport;
};

const toParticipant = (peer: Peer): VoiceParticipant => ({
  userId: peer.user.id,
  username: peer.user.username,
  muted: peer.muted,
  deafened: peer.deafened,
});

/** Tells those who may see a voice channel who is in it. */
const broadcastRoster = (channelId: number) => {
  void findChannelById(channelId)
    .then(async (channel) => {
      if (!channel) return;
      const participants = peersInChannel(channelId).map(toParticipant);
      emitToUsers(await channelAudience(channel), 'voice:roster', { channelId, participants });
    })
    .catch((err) => console.error('Could not send the voice roster:', err));
};

const producersInChannel = (channelId: number, exceptSocketId: string) =>
  peersInChannel(channelId).flatMap((peer) =>
    peer.socketId !== exceptSocketId && peer.producer
      ? [{ producerId: peer.producer.id, userId: peer.user.id }]
      : [],
  );

const emitSpeaking = (channelId: number, userIds: number[]) => {
  const key = userIds.toSorted((a, b) => a - b).join(',');
  if ((speakingByChannel.get(channelId) ?? '') === key) return;
  speakingByChannel.set(channelId, key);
  getIo().to(roomName(channelId)).emit('voice:speaking', { channelId, userIds });
};

const publishSpeakers = (producerIds: Set<string>) => {
  const channelIds = new Set([...peers.values()].map((peer) => peer.channelId));
  for (const channelId of channelIds) {
    const speaking = peersInChannel(channelId).filter((peer) => peer.producer && producerIds.has(peer.producer.id));
    emitSpeaking(channelId, speaking.map((peer) => peer.user.id));
  }
};

/** Forwards the loudest-speaker reports from the media engine to voice rooms. */
export function startSpeakerDetection(): void {
  const { audioLevelObserver } = getMediaEngine();
  audioLevelObserver.on('volumes', (volumes) => publishSpeakers(new Set(volumes.map((v) => v.producer.id))));
  audioLevelObserver.on('silence', () => publishSpeakers(new Set()));
}

/** Returns who is in each occupied voice channel this user may see. */
export async function getVoiceRosters(userId: number): Promise<{ channelId: number; participants: VoiceParticipant[] }[]> {
  const channelIds = [...new Set([...peers.values()].map((peer) => peer.channelId))];
  const visible = await Promise.all(
    channelIds.map(async (channelId) => {
      const channel = await findChannelById(channelId);
      return channel && (await channelAudience(channel)).includes(userId) ? channelId : null;
    }),
  );
  return visible
    .filter((channelId) => channelId !== null)
    .map((channelId) => ({ channelId, participants: peersInChannel(channelId).map(toParticipant) }));
}

/** Removes a socket from voice, releasing its media and telling the others. */
export function leaveVoice(socketId: string): void {
  const peer = peers.get(socketId);
  if (!peer) return;
  peers.delete(socketId);
  Object.values(peer.transports).forEach((transport) => transport.close());
  getIo().in(socketId).socketsLeave(roomName(peer.channelId));
  if (peersInChannel(peer.channelId).length === 0) speakingByChannel.delete(peer.channelId);
  broadcastRoster(peer.channelId);
}

/** Disconnects everyone from a voice channel that is being deleted. */
export function removeVoiceChannelPeers(channelId: number): void {
  for (const peer of peersInChannel(channelId)) {
    getIo().to(peer.socketId).emit('voice:kicked', { reason: 'This voice channel was deleted' });
    leaveVoice(peer.socketId);
  }
}

/** Removes someone who just lost access to a voice channel. */
export function removeUserFromVoiceChannel(channelId: number, userId: number): void {
  for (const peer of peersInChannel(channelId)) {
    if (peer.user.id !== userId) continue;
    getIo().to(peer.socketId).emit('voice:kicked', { reason: 'You no longer have access to this voice channel' });
    leaveVoice(peer.socketId);
  }
}

/** Puts a socket in a voice channel, replacing any other session of the same user. */
export async function joinVoice(socketId: string, user: AuthUser, channelId: number) {
  const channel = await requireChannelAccess(channelId, user.id);
  if (channel.type !== 'voice') throw new HttpError(404, 'Channel not found');

  leaveVoice(socketId);
  for (const peer of [...peers.values()]) {
    if (peer.user.id === user.id) {
      getIo().to(peer.socketId).emit('voice:kicked', { reason: 'You joined voice from another window' });
      leaveVoice(peer.socketId);
    }
  }
  if (peersInChannel(channelId).length >= config.MAX_USERS) throw new HttpError(403, 'This voice channel is full');

  peers.set(socketId, {
    socketId,
    user,
    channelId,
    muted: false,
    deafened: false,
    transports: {},
    consumers: new Map(),
  });
  getIo().in(socketId).socketsJoin(roomName(channelId));
  broadcastRoster(channelId);

  return {
    routerRtpCapabilities: getMediaEngine().router.rtpCapabilities,
    producers: producersInChannel(channelId, socketId),
  };
}

/** Creates the sending or receiving WebRTC transport for a peer. */
export async function createVoiceTransport(socketId: string, direction: TransportDirection) {
  const peer = requirePeer(socketId);
  const { router, webRtcServer } = getMediaEngine();
  const transport = await router.createWebRtcTransport({
    webRtcServer,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  if (peers.get(socketId) !== peer) {
    transport.close();
    throw new HttpError(409, 'You left the voice channel');
  }
  peer.transports[direction]?.close();
  peer.transports[direction] = transport;

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

/** Completes the DTLS handshake parameters for a transport. */
export async function connectVoiceTransport(
  socketId: string,
  transportId: string,
  dtlsParameters: types.DtlsParameters,
): Promise<void> {
  await requireTransport(requirePeer(socketId), transportId).connect({ dtlsParameters });
}

/** Publishes a peer's microphone and announces it to the channel. */
export async function produceVoice(
  socketId: string,
  transportId: string,
  rtpParameters: types.RtpParameters,
): Promise<{ id: string }> {
  const peer = requirePeer(socketId);
  const transport = requireTransport(peer, transportId);
  if (transport !== peer.transports.send) throw new HttpError(400, 'Not a sending transport');
  if (peer.producer) throw new HttpError(409, 'Microphone already published');

  const producer = await transport.produce({ kind: 'audio', rtpParameters });
  if (peers.get(socketId) !== peer) {
    producer.close();
    throw new HttpError(409, 'You left the voice channel');
  }
  peer.producer = producer;
  if (peer.muted) await producer.pause();
  await getMediaEngine().audioLevelObserver.addProducer({ producerId: producer.id });

  getIo()
    .to(roomName(peer.channelId))
    .except(socketId)
    .emit('voice:newProducer', { producerId: producer.id, userId: peer.user.id });
  return { id: producer.id };
}

/** Subscribes a peer to another participant's audio, starting paused until the client is ready. */
export async function consumeVoice(socketId: string, producerId: string, rtpCapabilities: types.RtpCapabilities) {
  const peer = requirePeer(socketId);
  const transport = peer.transports.recv;
  if (!transport) throw new HttpError(409, 'Receiving transport is not ready');

  const inSameChannel = peersInChannel(peer.channelId).some((other) => other.producer?.id === producerId);
  if (!inSameChannel) throw new HttpError(404, 'Audio source not found');
  if (!getMediaEngine().router.canConsume({ producerId, rtpCapabilities })) {
    throw new HttpError(400, 'Your browser cannot play this audio');
  }

  const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
  peer.consumers.set(consumer.id, consumer);
  consumer.on('transportclose', () => peer.consumers.delete(consumer.id));
  consumer.on('producerclose', () => {
    peer.consumers.delete(consumer.id);
    getIo().to(socketId).emit('voice:consumerClosed', { consumerId: consumer.id });
  });

  return { id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters };
}

/** Starts the flow of audio for a consumer. */
export async function resumeVoiceConsumer(socketId: string, consumerId: string): Promise<void> {
  const consumer = requirePeer(socketId).consumers.get(consumerId);
  if (!consumer) throw new HttpError(404, 'Audio stream not found');
  await consumer.resume();
}

/** Updates a peer's mute and deafen state. */
export async function setVoiceState(socketId: string, muted: boolean, deafened: boolean): Promise<void> {
  const peer = requirePeer(socketId);
  peer.muted = muted;
  peer.deafened = deafened;
  if (peer.producer) await (muted ? peer.producer.pause() : peer.producer.resume());
  broadcastRoster(peer.channelId);
}
