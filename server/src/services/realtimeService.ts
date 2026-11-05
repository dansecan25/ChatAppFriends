import { getIo } from '../connections/socket.js';

export const userRoom = (userId: number) => `user:${userId}`;
export const serverRoom = (serverId: number) => `server:${serverId}`;

/** Sends an event to specific users, on all their connections. */
export function emitToUsers(userIds: number[], event: string, payload: unknown): void {
  if (userIds.length > 0) getIo().to(userIds.map(userRoom)).emit(event, payload);
}

/** Sends an event to everyone in a server. */
export function emitToServer(serverId: number, event: string, payload: unknown): void {
  getIo().to(serverRoom(serverId)).emit(event, payload);
}

/** Stops a user's open connections from receiving a server's events. */
export function unsubscribeUserFromServer(userId: number, serverId: number): void {
  getIo().in(userRoom(userId)).socketsLeave(serverRoom(serverId));
}

/** Subscribes a user's open connections to a server's events. */
export function subscribeUserToServer(userId: number, serverId: number): void {
  getIo().in(userRoom(userId)).socketsJoin(serverRoom(serverId));
}
