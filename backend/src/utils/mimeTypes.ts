/**
 * Extension-to-MIME fallback for uploads that arrive without a usable type.
 *
 * The type on an upload is chosen by the client, and browsers only know the
 * extensions their platform has registered. Chrome on Windows sends
 * `application/octet-stream` for .heic, .heif, .avif, .opus, .flac, .mkv, .m4v
 * and .3gp — while the same file from an iPhone arrives correctly typed. Storing
 * whatever the client happened to say makes a photo behave differently depending
 * on the device it was uploaded from, which is the confusing part.
 *
 * The filename is attacker-controlled, so this only ever maps to a fixed value
 * from the table below; nothing from the request reaches the response verbatim.
 */
const BY_EXTENSION: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  svg: 'image/svg+xml',

  // Video
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  '3gp': 'video/3gpp',

  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',

  // Documents
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Archives
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip'
};

/** Types that carry no information, so the extension is a better guess. */
const GENERIC_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/unknown',
  'application/force-download'
]);

export function isGenericMimeType(mimeType: string | undefined | null): boolean {
  return GENERIC_TYPES.has((mimeType || '').split(';')[0].trim().toLowerCase());
}

export function mimeTypeFromFilename(filename: string): string | null {
  const extension = filename.toLowerCase().split('.').pop();
  return extension && extension !== filename.toLowerCase() ? BY_EXTENSION[extension] ?? null : null;
}

/**
 * The type to store: what the client claimed, unless that says nothing and the
 * extension does. A client that sends a real type is always believed — it knows
 * things a filename cannot express.
 */
export function resolveMimeType(claimed: string | undefined, filename: string): string {
  if (!isGenericMimeType(claimed)) {
    return claimed as string;
  }
  return mimeTypeFromFilename(filename) ?? 'application/octet-stream';
}
