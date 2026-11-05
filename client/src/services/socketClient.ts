import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/utils/env';

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 10_000;

export const socket: Socket = io(API_URL, { autoConnect: false, withCredentials: true });

/** Sends a socket request and resolves with the server's reply. */
export async function socketRequest<T>(event: string, payload: object = {}): Promise<T> {
  const response: AckResponse<T> = await socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck(event, payload);
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
