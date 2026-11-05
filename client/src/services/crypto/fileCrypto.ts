import * as messageApi from '@/api/messageApi';
import { API_URL } from '@/utils/env';
import { fromBase64, newSymmetricKey, toAesKey, toBase64, type Bytes } from './primitives';
import type { FilePayload } from './messageCrypto';

const CHUNK_BYTES = 4 * 1024 * 1024;
const TAG_BYTES = 16;
const IV_BYTES = 12;

/** Each file has its own key, so a counter is a safe IV. */
const chunkIv = (index: number): Bytes => {
  const iv = new Uint8Array(IV_BYTES);
  new DataView(iv.buffer).setUint32(IV_BYTES - 4, index);
  return iv;
};

/** Binds each chunk to its position and whether it's last, so chunks can't be reordered or dropped. */
const chunkContext = (index: number, last: boolean): Bytes => new TextEncoder().encode(`${index}|${last ? 1 : 0}`);

export interface FileUpload {
  promise: Promise<{ uploadId: string; file: FilePayload }>;
  cancel: () => void;
}

/** Encrypts and uploads a file one chunk at a time, so 1 GB never sits in memory. */
export function uploadEncryptedFile(
  thread: { kind: 'channel' | 'dm'; id: number },
  source: File,
  mimeType: string,
  onProgress: (fraction: number) => void,
): FileUpload {
  const controller = new AbortController();
  const run = async () => {
    const raw = newSymmetricKey();
    const key = await toAesKey(raw);
    const { uploadId } = await messageApi.startUpload(thread);
    const chunkCount = Math.max(1, Math.ceil(source.size / CHUNK_BYTES));
    try {
      for (let index = 0; index < chunkCount; index++) {
        const plain = await source.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES).arrayBuffer();
        const sealed = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: chunkIv(index), additionalData: chunkContext(index, index === chunkCount - 1) },
          key,
          plain,
        );
        await messageApi.putChunk(uploadId, index, sealed, controller.signal);
        onProgress((index + 1) / chunkCount);
      }
    } catch (err) {
      void messageApi.cancelUpload(uploadId).catch(() => undefined);
      throw err;
    }
    return {
      uploadId,
      file: { filename: source.name, mimeType, size: source.size, key: toBase64(raw), chunkSize: CHUNK_BYTES },
    };
  };
  return { promise: run(), cancel: () => controller.abort() };
}

/** Downloads and decrypts a file one chunk at a time into a Blob, which browsers can keep on disk. */
export async function downloadEncryptedFile(attachmentId: string, file: FilePayload, mimeType: string): Promise<Blob> {
  const key = await toAesKey(fromBase64(file.key));
  const chunkCount = Math.max(1, Math.ceil(file.size / file.chunkSize));
  const parts: BlobPart[] = [];
  for (let index = 0; index < chunkCount; index++) {
    const start = index * (file.chunkSize + TAG_BYTES);
    const end = Math.min(start + file.chunkSize + TAG_BYTES, file.size + chunkCount * TAG_BYTES) - 1;
    const response = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
      credentials: 'include',
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!response.ok) throw new Error('Could not download this file');
    parts.push(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: chunkIv(index), additionalData: chunkContext(index, index === chunkCount - 1) },
        key,
        await response.arrayBuffer(),
      ),
    );
  }
  return new Blob(parts, { type: mimeType });
}
