import { toMessage } from '@/mappers/messageMapper';
import type { MessageDto } from '@/types/dto';
import type { Message } from '@/types/models';
import { API_URL } from '@/utils/env';
import { ApiError, request } from './http';

export const MESSAGE_PAGE_SIZE = 50;

export interface ImageUpload {
  promise: Promise<Message>;
  cancel: () => void;
}

/** Fetches a page of messages, optionally older than a message id. */
export async function fetchMessages(channelId: number, before?: string): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
  if (before) query.set('before', before);
  const page = await request<MessageDto[]>(`/channels/${channelId}/messages?${query}`);
  return page.map(toMessage);
}

/** Posts a text message. */
export const sendMessage = async (channelId: number, content: string): Promise<Message> =>
  toMessage(await request<MessageDto>(`/channels/${channelId}/messages`, { method: 'POST', body: { content } }));

/** Uploads an image, using XHR because fetch cannot report upload progress. */
export function uploadImage(
  channelId: number,
  file: File,
  caption: string,
  onProgress: (fraction: number) => void,
): ImageUpload {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Message>((resolve, reject) => {
    xhr.open('POST', `${API_URL}/api/channels/${channelId}/images`);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status === 201) resolve(toMessage(xhr.response as MessageDto));
      else reject(new ApiError(xhr.status, xhr.response?.error ?? 'Upload failed'));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled'));

    const form = new FormData();
    form.append('caption', caption);
    form.append('image', file);
    xhr.send(form);
  });
  return { promise, cancel: () => xhr.abort() };
}
