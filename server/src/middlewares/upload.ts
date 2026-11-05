import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { uploadDirectory } from '../services/imageService.js';

/** Streams one image straight to disk so large uploads never sit in memory. */
export const uploadSingleImage = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: config.MAX_IMAGE_BYTES, files: 1, fields: 1, fieldSize: 8192 },
  defParamCharset: 'utf8',
}).single('image');
