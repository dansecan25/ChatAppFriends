import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import { findImageById } from '../models/messageModel.js';
import { requireChannel } from '../services/channelService.js';
import { assertDiskSpaceForUpload, deleteImageFile, uploadDirectory } from '../services/imageService.js';
import * as messageService from '../services/messageService.js';
import { HttpError } from '../utils/httpError.js';
import { sniffImageMimeType } from '../utils/imageSniffer.js';
import { channelIdSchema } from './channelController.js';

const captionSchema = z.string().trim().max(4000, 'Captions can have up to 4000 characters').default('');

/** Rejects doomed uploads before any bytes are stored. */
export async function checkUpload(req: Request, _res: Response, next: NextFunction): Promise<void> {
  await requireChannel(channelIdSchema.parse(req.params.channelId), 'text');
  await assertDiskSpaceForUpload();
  next();
}

/** POST /channels/:channelId/images */
export async function upload(req: Request, res: Response): Promise<void> {
  const { file } = req;
  if (!file) throw new HttpError(400, 'Choose an image to upload');
  try {
    const mimeType = await sniffImageMimeType(file.path);
    if (!mimeType) throw new HttpError(415, 'Only PNG, JPEG, GIF, WebP, AVIF and BMP images are supported');
    const message = await messageService.postMessage(
      channelIdSchema.parse(req.params.channelId),
      currentUser(req),
      captionSchema.parse(req.body?.caption),
      { id: file.filename, filename: file.originalname.slice(0, 255), mimeType, size: file.size },
    );
    res.status(201).json(message);
  } catch (err) {
    await deleteImageFile(file.filename);
    throw err;
  }
}

/** GET /images/:imageId, with range support so large files can resume. */
export async function download(req: Request, res: Response): Promise<void> {
  const imageId = z.uuid().safeParse(req.params.imageId);
  const image = imageId.success ? await findImageById(imageId.data) : null;
  if (!image) throw new HttpError(404, 'Image not found');

  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  if (req.query.download !== undefined) res.attachment(image.filename);
  res.setHeader('Content-Type', image.mimeType);
  res.sendFile(image.id, { root: uploadDirectory });
}
