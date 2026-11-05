import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middlewares/auth.js';
import { findMessageByAttachmentId, findMessageByImageId, type MessageDocument } from '../models/messageModel.js';
import { requireScopeAccess } from '../services/accessService.js';
import * as fileService from '../services/fileService.js';
import { HttpError } from '../utils/httpError.js';
import { scopeOf } from './messageController.js';

const uploadIdSchema = z.uuid();
const chunkIndexSchema = z.coerce.number().int().min(0);

const requireFileAccess = async (message: MessageDocument | null, userId: number): Promise<MessageDocument> => {
  if (!message) throw new HttpError(404, 'File not found');
  const scope = message.dmId ? { dmId: message.dmId } : { channelId: message.channelId as number };
  await requireScopeAccess(scope, userId).catch(() => {
    throw new HttpError(404, 'File not found');
  });
  return message;
};

const setFileHeaders = (res: Response) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
};

/** POST /channels/:channelId/uploads and /dms/:dmId/uploads */
export async function startUpload(req: Request, res: Response): Promise<void> {
  const scope = scopeOf(req);
  const userId = currentUser(req).id;
  await requireScopeAccess(scope, userId);
  res.status(201).json({ uploadId: await fileService.startUpload(userId, scope) });
}

/** PUT /uploads/:uploadId/chunks/:index */
export async function putChunk(req: Request, res: Response): Promise<void> {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Missing chunk data');
  await fileService.appendChunk(
    uploadIdSchema.parse(req.params.uploadId),
    currentUser(req).id,
    chunkIndexSchema.parse(req.params.index),
    req.body,
  );
  res.status(204).end();
}

/** DELETE /uploads/:uploadId */
export async function cancelUpload(req: Request, res: Response): Promise<void> {
  await fileService.cancelUpload(uploadIdSchema.parse(req.params.uploadId), currentUser(req).id);
  res.status(204).end();
}

/** GET /attachments/:attachmentId, with range support so files download one chunk at a time. */
export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  const parsed = uploadIdSchema.safeParse(req.params.attachmentId);
  const message = parsed.success ? await findMessageByAttachmentId(parsed.data) : null;
  await requireFileAccess(message, currentUser(req).id);
  setFileHeaders(res);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(parsed.data as string, { root: fileService.uploadDirectory });
}

/** GET /images/:imageId, for images uploaded before encryption. */
export async function downloadLegacyImage(req: Request, res: Response): Promise<void> {
  const parsed = uploadIdSchema.safeParse(req.params.imageId);
  const message = parsed.success ? await findMessageByImageId(parsed.data) : null;
  const { image } = await requireFileAccess(message, currentUser(req).id);
  if (!image) throw new HttpError(404, 'File not found');
  setFileHeaders(res);
  if (req.query.download !== undefined) res.attachment(image.filename);
  res.setHeader('Content-Type', image.mimeType);
  res.sendFile(image.id, { root: fileService.uploadDirectory });
}
