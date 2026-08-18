import { Request, Response, NextFunction } from 'express';
import { getDb, SharePermission } from '../utils/db.js';

export interface ResolvedShare {
  id: string;
  token: string;
  bucketId: string;
  bucketName: string;
  bucketIsPublic: boolean;
  /** Non-null when the link points at one specific file instead of the bucket. */
  fileId: string | null;
  permission: SharePermission;
  label: string | null;
  expiresAt: string | null;
}

export interface ShareRequest extends Request {
  share?: ResolvedShare;
}

/**
 * Looks a share token up and rejects expired ones. Returns null for anything
 * unusable, so callers cannot accidentally distinguish "wrong token" from
 * "expired token" and probe for valid links.
 */
export async function resolveShareToken(token: string): Promise<ResolvedShare | null> {
  if (!token || typeof token !== 'string') return null;

  const row = await getDb().get(
    `SELECT s.id, s.token, s.bucket_id, s.file_id, s.permission, s.label, s.expires_at,
            b.name AS bucket_name, b.is_public
     FROM shares s
     JOIN buckets b ON b.id = s.bucket_id
     WHERE s.token = ?`,
    [token]
  );

  if (!row) return null;

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return {
    id: row.id,
    token: row.token,
    bucketId: row.bucket_id,
    bucketName: row.bucket_name,
    bucketIsPublic: Boolean(row.is_public),
    fileId: row.file_id,
    permission: row.permission as SharePermission,
    label: row.label,
    expiresAt: row.expires_at
  };
}

/** Attaches the share behind :token, or 404s so invalid links look like dead links. */
export async function resolveShare(req: ShareRequest, res: Response, next: NextFunction) {
  try {
    const share = await resolveShareToken(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Tautan berbagi tidak valid atau sudah kedaluwarsa.' });
    }

    req.share = share;
    next();
  } catch (error) {
    console.error('Share resolution error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** Upload and delete are limited to editor links. */
export function requireShareEditor(req: ShareRequest, res: Response, next: NextFunction) {
  if (req.share?.permission !== 'editor') {
    return res.status(403).json({ error: 'Tautan ini hanya untuk melihat dan mengunduh.' });
  }
  next();
}

/** A file-scoped link may never reach into the rest of the bucket. */
export function assertShareCoversFile(share: ResolvedShare, fileId: string): boolean {
  return !share.fileId || share.fileId === fileId;
}
