import { useCallback, useState } from 'react';
import { checkProxyUploadLimit, uploadWithProgress } from '../lib/upload';

export type UploadStatus = 'menunggu' | 'mengunggah' | 'selesai' | 'gagal';

export interface UploadItem {
  /** Stable key for React across re-renders of the queue. */
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0-100, only meaningful while status is 'mengunggah'. */
  progress: number;
  /** Why this one failed — shown next to the file, not in a toast. */
  error?: string;
}

export interface UploadTarget {
  url: string;
  headers?: Record<string, string>;
  /** Multipart fields sent with every file in the batch. */
  fields?: Record<string, string>;
}

export interface UploadSummary {
  succeeded: number;
  failed: number;
}

/**
 * Runs a batch of uploads one after another and reports per-file state.
 *
 * Sequential rather than parallel on purpose: this server exists for large media
 * files over a home connection, and several concurrent uploads there just split
 * the same bandwidth while making every progress bar crawl. It also keeps bucket
 * quota checks meaningful — parallel uploads race the read-then-write check and
 * can overshoot the ceiling together.
 *
 * A file that fails does not stop the batch. One oversized file among twenty
 * should not cancel the other nineteen.
 */
export function useUploads() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => setItems([]), []);

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems(current => current.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const start = useCallback(async (
    files: File[],
    target: UploadTarget
  ): Promise<UploadSummary> => {
    if (files.length === 0) return { succeeded: 0, failed: 0 };

    const queue = files.map((file, index) => ({
      file,
      item: {
        // The name alone is not unique — dropping two folders can bring two
        // files called the same thing.
        id: `${index}-${file.name}-${file.size}`,
        name: file.name,
        size: file.size,
        status: 'menunggu' as UploadStatus,
        progress: 0
      }
    }));

    setItems(queue.map(entry => entry.item));
    setBusy(true);

    let succeeded = 0;
    let failed = 0;

    for (const { file, item } of queue) {
      // Refused before sending: the proxy would reject the body anyway, and
      // finding that out after a long upload is the worst possible moment.
      const limitError = checkProxyUploadLimit(file);
      if (limitError) {
        update(item.id, { status: 'gagal', error: limitError });
        failed += 1;
        continue;
      }

      update(item.id, { status: 'mengunggah', progress: 0 });

      try {
        await uploadWithProgress({
          url: target.url,
          file,
          headers: target.headers ?? {},
          fields: target.fields ?? {},
          onProgress: percent => update(item.id, { progress: percent })
        });
        update(item.id, { status: 'selesai', progress: 100 });
        succeeded += 1;
      } catch (error) {
        update(item.id, { status: 'gagal', error: (error as Error).message });
        failed += 1;
      }
    }

    setBusy(false);
    return { succeeded, failed };
  }, [update]);

  return { items, busy, start, reset };
}

/** One sentence covering a finished batch, for the toast. */
export function summarize({ succeeded, failed }: UploadSummary): string {
  if (failed === 0) {
    return succeeded === 1 ? 'Berkas berhasil diunggah.' : `${succeeded} berkas berhasil diunggah.`;
  }
  if (succeeded === 0) {
    return failed === 1 ? 'Berkas gagal diunggah.' : `${failed} berkas gagal diunggah.`;
  }
  return `${succeeded} berkas berhasil, ${failed} gagal. Lihat rinciannya di daftar.`;
}
