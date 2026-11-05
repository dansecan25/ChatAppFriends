export const MAX_IMAGE_BYTES = 1024 ** 3;
const AVATAR_PIXELS = 256;
const AUTO_LOAD_LIMIT_BYTES = 25 * 1024 ** 2;

/** Tells whether an image is too large to download without asking. */
export function shouldLoadOnDemand(size: number): boolean {
  return size > AUTO_LOAD_LIMIT_BYTES;
}

/** Returns why a file cannot be uploaded, or null when it can. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return 'That file is not a supported image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images can be at most 1 GB.';
  return null;
}

const startsWith = (header: Uint8Array, bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
const ascii = (header: Uint8Array, start: number, end: number) => String.fromCharCode(...header.subarray(start, end));

/** Detects a browser-safe image type from file contents; SVG is excluded because it can run scripts. */
export function sniffImageType(header: Uint8Array): string | null {
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(header, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(ascii(header, 0, 6))) return 'image/gif';
  if (ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(header, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(header, 8, 12))) return 'image/avif';
  if (ascii(header, 0, 2) === 'BM') return 'image/bmp';
  return null;
}

/** Reads a blob's first bytes and returns its image type. */
export const sniffBlobType = async (blob: Blob): Promise<string | null> =>
  sniffImageType(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));

/** Crops a picture to a small centred square, which also strips data such as location from the original. */
export async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PIXELS;
  canvas.height = AVATAR_PIXELS;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_PIXELS,
    AVATAR_PIXELS,
  );
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read that picture'))), 'image/webp', 0.85);
  });
}
