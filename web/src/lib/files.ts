import type { Bucket, FileItem } from '../types';

export type FileKind = 'image' | 'video' | 'audio' | 'document' | 'other';

export function getFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

interface FileUrlOptions {
  apiUrl: string;
  bucket: Bucket | undefined;
  bucketName: string;
  file: FileItem;
  /** Appended for private buckets so <img>/<video> tags can authenticate. */
  token?: string | null;
}

/** Shareable URL. Private buckets need the token, public ones stay clean. */
export function buildFileUrl({ apiUrl, bucket, bucketName, file, token }: FileUrlOptions): string {
  const base = `${apiUrl}/s/${bucketName}/${file.name}?id=${file.id}`;
  const needsToken = bucket ? !bucket.isPublic : false;

  return needsToken && token ? `${base}&token=${token}` : base;
}

/** Same URL without credentials — what you hand to someone else. */
export function buildPublicFileUrl(apiUrl: string, bucketName: string, file: FileItem): string {
  return `${apiUrl}/s/${bucketName}/${file.name}?id=${file.id}`;
}
