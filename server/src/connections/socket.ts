import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config.js';

let io: Server | undefined;

/** Attaches Socket.IO to the HTTP server, refusing connections from other origins. */
export function createSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: config.CLIENT_ORIGIN, credentials: true },
    maxHttpBufferSize: 1_000_000,
    allowRequest: (req, callback) => callback(null, req.headers.origin === config.CLIENT_ORIGIN),
  });
  return io;
}

/** Returns the Socket.IO server. */
export function getIo(): Server {
  if (!io) throw new Error('Socket server is not running');
  return io;
}
