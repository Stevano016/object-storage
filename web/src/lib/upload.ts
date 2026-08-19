import { formatBytes } from './format';

/** Cloudflare's Free and Pro plans reject request bodies larger than 100 MB. */
export const PROXY_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

/**
 * Returns an error message when a file cannot possibly reach the server, or
 * null when it can. Only HTTPS origins are checked: that is how the dashboard
 * is reached through the Cloudflare proxy, while LAN and Tailscale access is
 * plain HTTP and hits the server directly with no body limit.
 */
export function checkProxyUploadLimit(file: File): string | null {
  if (window.location.protocol !== 'https:' || file.size <= PROXY_UPLOAD_LIMIT_BYTES) {
    return null;
  }

  return `Berkas ${formatBytes(file.size)} melampaui batas 100 MB untuk unggahan lewat domain publik. `
    + 'Untuk berkas sebesar ini, unggah lewat alamat lokal server.';
}

interface UploadOptions {
  url: string;
  file: File;
  headers?: Record<string, string>;
  /** Extra multipart fields, e.g. the folder the file belongs in. */
  fields?: Record<string, string>;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads through XMLHttpRequest rather than fetch, because only XHR reports
 * upload progress — important for the large media files this server targets.
 */
export function uploadWithProgress({
  url,
  file,
  headers = {},
  fields = {},
  onProgress
}: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    // Fields first: multer only exposes text fields that arrived before the file.
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
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
