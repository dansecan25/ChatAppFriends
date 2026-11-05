import { listServersForUser } from '../models/serverModel.js';
import { emitToServer } from './realtimeService.js';

const connectionCounts = new Map<number, number>();

/** Tells whether a user has at least one open connection. */
export const isOnline = (userId: number): boolean => connectionCounts.has(userId);

/** Tells only the servers this user is in, so other servers never learn about them. */
const announce = async (userId: number, online: boolean): Promise<void> => {
  for (const server of await listServersForUser(userId)) {
    emitToServer(server.id, 'presence:changed', { serverId: server.id, userId, online });
  }
};

/** Records a new connection, announcing the user when it's their first. */
export function userConnected(userId: number): void {
  const count = connectionCounts.get(userId) ?? 0;
  connectionCounts.set(userId, count + 1);
  if (count === 0) void announce(userId, true).catch((err) => console.error('Could not announce presence:', err));
}

/** Records a closed connection, announcing the user when it was their last. */
export function userDisconnected(userId: number): void {
  const count = (connectionCounts.get(userId) ?? 1) - 1;
  if (count > 0) {
    connectionCounts.set(userId, count);
    return;
  }
  connectionCounts.delete(userId);
  void announce(userId, false).catch((err) => console.error('Could not announce presence:', err));
}
