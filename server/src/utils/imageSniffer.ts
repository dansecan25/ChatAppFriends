import { open } from 'node:fs/promises';

const startsWith = (header: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => header[offset + index] === byte);
const ascii = (header: Buffer, start: number, end: number) => header.toString('latin1', start, end);

/** Detects a browser-safe image type from file contents; SVG is excluded because it can run scripts. */
export async function sniffImageMimeType(path: string): Promise<string | null> {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(16);
    await file.read(header, 0, header.length, 0);
    if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (startsWith(header, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (['GIF87a', 'GIF89a'].includes(ascii(header, 0, 6))) return 'image/gif';
    if (ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WEBP') return 'image/webp';
    if (ascii(header, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(header, 8, 12))) return 'image/avif';
    if (ascii(header, 0, 2) === 'BM') return 'image/bmp';
    return null;
  } finally {
    await file.close();
  }
}
