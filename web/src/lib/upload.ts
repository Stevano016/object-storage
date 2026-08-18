interface UploadOptions {
  url: string;
  file: File;
  headers?: Record<string, string>;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads through XMLHttpRequest rather than fetch, because only XHR reports
 * upload progress — important for the large media files this server targets.
 */
export function uploadWithProgress({ url, file, headers = {}, onProgress }: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      let message = 'Gagal mengunggah berkas.';
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {
        // Non-JSON error body (e.g. a proxy timeout page): keep the default text.
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Jaringan bermasalah saat mengunggah.'));

    xhr.send(formData);
  });
}
