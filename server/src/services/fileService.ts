import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readdir, rename, statfs, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config.js';
import type { MessageScope } from '../models/messageModel.js';
import { HttpError } from '../utils/httpError.js';

/** Encrypted chunks arrive one at a time, so 1 GB never sits in memory on either side. */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024 + 16;
const MAX_ACTIVE_UPLOADS_PER_USER = 4;
const UPLOAD_IDLE_LIMIT_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const PART_SUFFIX = '.part';
/** Room for each chunk's authentication tag on top of the image limit. */
const maxEncryptedBytes = () => config.MAX_IMAGE_BYTES + Math.ceil(config.MAX_IMAGE_BYTES / (4 * 1024 * 1024)) * 16 + 16;

export const uploadDirectory = resolve(config.UPLOAD_DIR);

interface Upload {
  id: string;
  ownerId: number;
  scope: MessageScope;
  nextChunk: number;
  size: number;
  lastActivity: number;
}

const uploads = new Map<string, Upload>();

const partPath = (id: string) => resolve(uploadDirectory, `${id}${PART_SUFFIX}`);

const ignoreMissing = (err: NodeJS.ErrnoException) => {
  if (err.code !== 'ENOENT') throw err;
};

/** Removes a stored file, ignoring files that are already gone. */
export async function deleteStoredFile(id: string): Promise<void> {
  await unlink(resolve(uploadDirectory, id)).catch(ignoreMissing);
}

const discardUpload = async (upload: Upload) => {
  uploads.delete(upload.id);
  await unlink(partPath(upload.id)).catch(ignoreMissing);
};

/** Prepares the upload folder, clears unfinished uploads and starts the cleanup timer. */
export async function initializeFileStorage(): Promise<void> {
  await mkdir(uploadDirectory, { recursive: true });
  const leftovers = (await readdir(uploadDirectory)).filter((name) => name.endsWith(PART_SUFFIX));
  await Promise.all(leftovers.map((name) => unlink(resolve(uploadDirectory, name)).catch(ignoreMissing)));

  setInterval(() => {
    const cutoff = Date.now() - UPLOAD_IDLE_LIMIT_MS;
    for (const upload of uploads.values()) {
      if (upload.lastActivity < cutoff) void discardUpload(upload).catch(console.error);
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

/** Starts an upload. Callers check access to the scope first. */
export async function startUpload(ownerId: number, scope: MessageScope): Promise<string> {
  const active = [...uploads.values()].filter((upload) => upload.ownerId === ownerId).length;
  if (active >= MAX_ACTIVE_UPLOADS_PER_USER) throw new HttpError(429, 'Too many uploads at once');
  const stats = await statfs(uploadDirectory);
  if (stats.bavail * stats.bsize < config.MAX_IMAGE_BYTES) {
    throw new HttpError(507, 'The server is running out of disk space');
  }
  const id = randomUUID();
  uploads.set(id, { id, ownerId, scope, nextChunk: 0, size: 0, lastActivity: Date.now() });
  return id;
}

const requireUpload = (id: string, ownerId: number): Upload => {
  const upload = uploads.get(id);
  if (!upload || upload.ownerId !== ownerId) throw new HttpError(404, 'Upload not found');
  return upload;
};

/** Appends the next chunk. Resending the previous chunk is ignored, so retries are safe. */
export async function appendChunk(id: string, ownerId: number, index: number, chunk: Buffer): Promise<void> {
  const upload = requireUpload(id, ownerId);
  if (index === upload.nextChunk - 1) return;
  if (index !== upload.nextChunk) throw new HttpError(409, 'Chunks must arrive in order');
  if (upload.size + chunk.length > maxEncryptedBytes()) throw new HttpError(413, 'Images can be at most 1 GB');

  upload.nextChunk += 1;
  upload.size += chunk.length;
  upload.lastActivity = Date.now();
  await appendFile(partPath(id), chunk);
}

/** Cancels an upload. */
export async function cancelUpload(id: string, ownerId: number): Promise<void> {
  await discardUpload(requireUpload(id, ownerId));
}

const sameScope = (a: MessageScope, b: MessageScope) => JSON.stringify(a) === JSON.stringify(b);

/** Finishes an upload for a message in the same place it was started. */
export async function finishUpload(id: string, ownerId: number, scope: MessageScope) {
  const upload = requireUpload(id, ownerId);
  if (!sameScope(upload.scope, scope) || upload.size === 0) throw new HttpError(400, 'That upload cannot be used here');
  uploads.delete(id);
  await rename(partPath(id), resolve(uploadDirectory, id));
  return { id, encryptedSize: upload.size };
}
