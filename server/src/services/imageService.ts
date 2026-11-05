import { mkdir, statfs, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

export const uploadDirectory = resolve(config.UPLOAD_DIR);

/** Creates the upload directory when missing. */
export async function ensureUploadDirectory(): Promise<void> {
  await mkdir(uploadDirectory, { recursive: true });
}

/** Rejects an upload early when the disk could not hold a maximum-size image. */
export async function assertDiskSpaceForUpload(): Promise<void> {
  const stats = await statfs(uploadDirectory);
  if (stats.bavail * stats.bsize < config.MAX_IMAGE_BYTES) {
    throw new HttpError(507, 'The server is running out of disk space');
  }
}

/** Removes a stored image, ignoring files that are already gone. */
export async function deleteImageFile(imageId: string): Promise<void> {
  await unlink(resolve(uploadDirectory, imageId)).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') throw err;
  });
}
