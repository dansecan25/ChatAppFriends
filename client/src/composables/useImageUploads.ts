import { ref } from 'vue';
import { uploadImage } from '@/api/messageApi';
import { useMessageStore } from '@/stores/messageStore';
import { errorMessage } from '@/utils/errors';
import { formatBytes } from '@/utils/format';

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
  const messages = useMessageStore();
  const uploads = ref<UploadItem[]>([]);
  const uploadError = ref<string | null>(null);

  /** Starts uploading an image to a channel. */
  async function start(channelId: number, file: File, caption: string): Promise<void> {
    const id = nextUploadId++;
    let cancelled = false;
    const upload = uploadImage(channelId, file, caption, (fraction) => {
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
    uploadError.value = null;

    try {
      messages.addMessage(await upload.promise);
    } catch (err) {
      if (!cancelled) uploadError.value = `${file.name}: ${errorMessage(err, 'Upload failed')}`;
    } finally {
      uploads.value = uploads.value.filter((candidate) => candidate.id !== id);
    }
  }

  return { uploads, uploadError, start };
}
