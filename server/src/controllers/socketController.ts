import type { Server, Socket } from 'socket.io';
import type { types } from 'mediasoup';
import { z } from 'zod';
import { requireSocketAuth } from '../middlewares/auth.js';
import type { AuthUser } from '../models/userModel.js';
import { listServersForUser } from '../models/serverModel.js';
import { userConnected, userDisconnected } from '../services/presenceService.js';
import { serverRoom, userRoom } from '../services/realtimeService.js';
import * as voiceService from '../services/voiceService.js';
import { HttpError } from '../utils/httpError.js';

type Ack = (response: { ok: true; data: unknown } | { ok: false; error: string }) => void;

const id = z.string().min(1).max(64);
const params = z.looseObject({});

const joinSchema = z.object({ channelId: z.number().int().positive() });
const transportSchema = z.object({ direction: z.enum(['send', 'recv']) });
const connectSchema = z.object({ transportId: id, dtlsParameters: params });
const produceSchema = z.object({ transportId: id, rtpParameters: params });
const consumeSchema = z.object({ producerId: id, rtpCapabilities: params });
const resumeSchema = z.object({ consumerId: id });
const stateSchema = z.object({ muted: z.boolean(), deafened: z.boolean() });

/** Registers a validated request/response socket event. */
function handle<T>(socket: Socket, event: string, schema: z.ZodType<T>, handler: (payload: T) => Promise<unknown>) {
  socket.on(event, async (payload: unknown, ack: unknown) => {
    if (typeof ack !== 'function') return;
    try {
      (ack as Ack)({ ok: true, data: await handler(schema.parse(payload)) });
    } catch (err) {
      if (!(err instanceof HttpError) && !(err instanceof z.ZodError)) console.error(`${event} failed:`, err);
      (ack as Ack)({ ok: false, error: err instanceof HttpError ? err.message : 'Voice request failed' });
    }
  });
}

/** Wires up one authenticated socket. */
function onConnection(socket: Socket): void {
  const user = socket.data.user as AuthUser;

  void socket.join(userRoom(user.id));
  userConnected(user.id);
  void listServersForUser(user.id)
    .then((servers) => socket.join(servers.map((server) => serverRoom(server.id))))
    .then(() => voiceService.getVoiceRosters(user.id))
    .then((rosters) => socket.emit('voice:rosters', rosters))
    .catch((err) => console.error('Could not set up a socket:', err));

  handle(socket, 'voice:join', joinSchema, ({ channelId }) => voiceService.joinVoice(socket.id, user, channelId));
  handle(socket, 'voice:createTransport', transportSchema, ({ direction }) =>
    voiceService.createVoiceTransport(socket.id, direction),
  );
  handle(socket, 'voice:connectTransport', connectSchema, ({ transportId, dtlsParameters }) =>
    voiceService.connectVoiceTransport(socket.id, transportId, dtlsParameters as unknown as types.DtlsParameters),
  );
  handle(socket, 'voice:produce', produceSchema, ({ transportId, rtpParameters }) =>
    voiceService.produceVoice(socket.id, transportId, rtpParameters as unknown as types.RtpParameters),
  );
  handle(socket, 'voice:consume', consumeSchema, ({ producerId, rtpCapabilities }) =>
    voiceService.consumeVoice(socket.id, producerId, rtpCapabilities as unknown as types.RtpCapabilities),
  );
  handle(socket, 'voice:resume', resumeSchema, ({ consumerId }) =>
    voiceService.resumeVoiceConsumer(socket.id, consumerId),
  );
  handle(socket, 'voice:setState', stateSchema, ({ muted, deafened }) =>
    voiceService.setVoiceState(socket.id, muted, deafened),
  );
  handle(socket, 'voice:leave', z.object({}), async () => voiceService.leaveVoice(socket.id));

  socket.on('disconnect', () => {
    voiceService.leaveVoice(socket.id);
    userDisconnected(user.id);
  });
}

/** Registers authentication and socket handlers on the server. */
export function registerSocketHandlers(io: Server): void {
  io.use(requireSocketAuth);
  io.on('connection', onConnection);
}
