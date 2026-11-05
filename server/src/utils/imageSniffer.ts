const startsWith = (header: Buffer, bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
const ascii = (header: Buffer, start: number, end: number) => header.toString('latin1', start, end);

/** Returns the file extension of a safe profile picture from its contents, or null for anything else. */
export function sniffAvatarExtension(data: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'jpg';
  if (ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 12) === 'WEBP') return 'webp';
  return null;
}
