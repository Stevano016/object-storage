import type { FileItem } from '../types';

export type FileKind = 'image' | 'video' | 'audio' | 'document' | 'other';

export function getFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

/** How an anonymous or logged-in caller proves it may read a private file. */
export type FileCredential =
  | { kind: 'token'; value: string }
  | { kind: 'share'; value: string }
  | null
  | undefined;

interface FileUrlOptions {
  apiUrl: string;
  bucketName: string;
  file: FileItem;
  credential?: FileCredential;
  /** Sends Content-Disposition: attachment so the browser saves instead of opens. */
  download?: boolean;
}

export function buildFileUrl({ apiUrl, bucketName, file, credential, download }: FileUrlOptions): string {
  const params = new URLSearchParams({ id: file.id });

  if (credential?.kind === 'token') params.set('token', credential.value);
  if (credential?.kind === 'share') params.set('share', credential.value);
  if (download) params.set('download', '1');

  return `${apiUrl}/s/${bucketName}/${file.name}?${params.toString()}`;
}

/** The same URL stripped of credentials — what you hand to someone else. */
export function buildPublicFileUrl(apiUrl: string, bucketName: string, file: FileItem): string {
  return buildFileUrl({ apiUrl, bucketName, file });
}

export function buildShareUrl(apiUrl: string, token: string): string {
  return `${apiUrl}/share/${token}`;
}
