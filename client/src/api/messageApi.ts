import type { MessageDto } from '@/types/dto';
import { API_URL } from '@/utils/env';
import { ApiError, request } from './http';

export const MESSAGE_PAGE_SIZE = 50;

type ThreadRef = { kind: 'channel' | 'dm'; id: number };

const threadPath = ({ kind, id }: ThreadRef) => `/${kind === 'channel' ? 'channels' : 'dms'}/${id}`;

/** Fetches a page of messages, optionally older than a message id. */
export function fetchMessages(thread: ThreadRef, before?: string): Promise<MessageDto[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
  if (before) query.set('before', before);
  return request(`${threadPath(thread)}/messages?${query}`);
}

/** Posts an encrypted message. */
export const postMessage = (
  thread: ThreadRef,
  body: { ciphertext: string; keyVersion: number; uploadId?: string },
): Promise<MessageDto> => request(`${threadPath(thread)}/messages`, { method: 'POST', body });

/** Starts an encrypted upload. */
export const startUpload = (thread: ThreadRef): Promise<{ uploadId: string }> =>
  request(`${threadPath(thread)}/uploads`, { method: 'POST' });

/** Uploads one encrypted chunk. */
export async function putChunk(uploadId: string, index: number, chunk: ArrayBuffer, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${API_URL}/api/uploads/${uploadId}/chunks/${index}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: chunk,
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error ?? 'Upload failed');
  }
}

/** Cancels an upload. */
export const cancelUpload = (uploadId: string): Promise<void> => request(`/uploads/${uploadId}`, { method: 'DELETE' });
