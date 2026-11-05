export const MAX_IMAGE_BYTES = 1024 ** 3;
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
