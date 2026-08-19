/**
 * HEIC/HEIF decoding for the browser.
 *
 * No browser except Safari can render HEIC, and it is the default photo format
 * on every recent iPhone — so an `<img src>` pointing at one shows a broken
 * image no matter how correct the MIME type is. The only way to display it is to
 * decode it here, which `heic-to` does with a libheif WebAssembly build.
 *
 * The `/csp` entry point is deliberate: the default build evaluates its glue
 * code as a string, which the dashboard's Content-Security-Policy forbids.
 */

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const HEIC_EXTENSIONS = ['.heic', '.heif'];

export function isHeicFile(mimeType: string, filename: string): boolean {
  if (HEIC_TYPES.has((mimeType || '').split(';')[0].trim().toLowerCase())) return true;
  // Covers files stored before the server learned to read the extension.
  const name = (filename || '').toLowerCase();
  return HEIC_EXTENSIONS.some(extension => name.endsWith(extension));
}

/**
 * Longest edge of a cached preview, in pixels.
 *
 * A 24-megapixel iPhone photo re-encodes to a 4 MB JPEG, and holding forty of
 * those costs 160 MB of tab memory for images displayed at a fraction of the
 * size. Downscaling first brings a grid thumbnail to roughly 60 KB and the
 * full-view copy to a few hundred, at no visible cost on screen.
 */
export const THUMBNAIL_MAX_EDGE = 480;
export const VIEWER_MAX_EDGE = 2000;

/** Decoded results, keyed by file id and the size they were rendered at. */
const cache = new Map<string, string>();
const MAX_CACHED = 40;

function remember(fileId: string, url: string) {
  cache.set(fileId, url);
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const stale = cache.get(oldest);
    cache.delete(oldest);
    if (stale) URL.revokeObjectURL(stale);
  }
}

/**
 * Decoding is serialized across the whole app.
 *
 * A grid can hold two dozen photos, and letting them all decode at once freezes
 * the tab and spikes memory. One at a time means the first thumbnails appear
 * quickly and the rest fill in while the page stays responsive.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  // The chain must not break when one decode fails.
  queue = result.catch(() => undefined);
  return result;
}

/**
 * A failure inside the worker surfaces as a bare ErrorEvent rather than an
 * Error, so callers cannot rely on `.message`. Everything is normalised into a
 * real Error here, once, instead of in every call site.
 */
async function decode(blob: Blob, maxEdge: number | null): Promise<Blob> {
  try {
    const { heicTo } = await import('heic-to/csp');

    // Full resolution: hand back the encoder's own JPEG, no resampling.
    if (maxEdge === null) {
      return await heicTo({ blob, type: 'image/jpeg', quality: 0.85 });
    }

    const bitmap = await heicTo({ blob, type: 'bitmap' });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Frees the decoded frame immediately rather than waiting for a GC pass.
    bitmap.close();

    const resized = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!resized) throw new Error('Gagal menyusun gambar hasil dekode.');
    return resized;
  } catch (cause) {
    const detail = cause instanceof Error && cause.message ? ` (${cause.message})` : '';
    throw new Error(`Dekoder HEIC gagal membaca berkas ini${detail}.`);
  }
}

/**
 * Fetches a stored HEIC and returns an object URL for the decoded JPEG.
 * Repeated calls for the same file reuse the first result.
 */
export async function heicPreviewUrl(
  fileId: string,
  sourceUrl: string,
  maxEdge: number = VIEWER_MAX_EDGE
): Promise<string> {
  const key = `${fileId}@${maxEdge}`;
  const cached = cache.get(key);
  if (cached) return cached;

  return enqueue(async () => {
    // Checked again inside the queue: several cards can ask at once, and the
    // first one through should be the only one that decodes.
    const existing = cache.get(key);
    if (existing) return existing;

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil berkas (HTTP ${response.status}).`);
    }

    const url = URL.createObjectURL(await decode(await response.blob(), maxEdge));
    remember(key, url);
    return url;
  });
}

/** Decodes to a JPEG blob for saving, bypassing the preview cache. */
export async function heicToJpegBlob(sourceUrl: string): Promise<Blob> {
  return enqueue(async () => {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil berkas (HTTP ${response.status}).`);
    }
    // Saved copies keep every pixel; this one is not for the screen.
    return decode(await response.blob(), null);
  });
}

/** Swaps a .heic/.heif extension for .jpg on the saved copy. */
export function jpegFilename(originalName: string): string {
  return originalName.replace(/\.(heic|heif)$/i, '') + '.jpg';
}
