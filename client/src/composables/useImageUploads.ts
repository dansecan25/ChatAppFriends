import { ref } from 'vue';
import type { Thread } from '@/services/crypto/keyring';
import { uploadEncryptedFile } from '@/services/crypto/fileCrypto';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { errorMessage } from '@/utils/errors';
import { formatBytes } from '@/utils/format';
import { sniffBlobType } from '@/utils/images';

export interface UploadItem {
  id: number;
  filename: string;
  sizeLabel: string;
  progress: number;
  cancel: () => void;
}

let nextUploadId = 1;

/** Tracks image uploads in progress, so they can show progress and be cancelled. */
export function useImageUploads() {
  const auth = useAuthStore();
  const messages = useMessageStore();
  const uploads = ref<UploadItem[]>([]);
  const uploadError = ref<string | null>(null);

  /** Checks, encrypts and uploads an image, then sends it as a message. */
  async function start(thread: Thread, file: File, caption: string): Promise<void> {
    const id = nextUploadId++;
    let cancelled = false;
    uploadError.value = null;
    const mimeType = await sniffBlobType(file);
    if (!mimeType) {
      uploadError.value = `${file.name}: Only PNG, JPEG, GIF, WebP, AVIF and BMP images are supported`;
      return;
    }
    const upload = uploadEncryptedFile(thread, file, mimeType, (fraction) => {
      const item = uploads.value.find((candidate) => candidate.id === id);
      if (item) item.progress = fraction;
    });
    uploads.value.push({
      id,
      filename: file.name,
      sizeLabel: formatBytes(file.size),
      progress: 0,
      cancel: () => {
        cancelled = true;
        upload.cancel();
      },
    });

    try {
      await messages.send(thread, (auth.user as { id: number }).id, caption, await upload.promise);
    } catch (err) {
      if (!cancelled) uploadError.value = `${file.name}: ${errorMessage(err, 'Upload failed')}`;
    } finally {
      uploads.value = uploads.value.filter((candidate) => candidate.id !== id);
    }
  }

  return { uploads, uploadError, start };
}
