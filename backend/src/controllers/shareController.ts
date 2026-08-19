import { Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, SharePermission } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ShareRequest, assertShareCoversFile } from '../middleware/share.js';
import {
  listBucketFiles,
  storeUploadedFile,
  removeBucketFile,
  discardTempUpload
} from './fileController.js';
import { QuotaExceededError } from '../utils/quota.js';

const PERMISSIONS: SharePermission[] = ['viewer', 'editor'];
const MAX_EXPIRY_DAYS = 3650;

interface ShareRow {
  id: string;
  token: string;
  permission: SharePermission;
  label: string | null;
  expires_at: string | null;
  created_at: string;
  bucket_name: string;
  file_id: string | null;
  original_name: string | null;
}

const toShareDto = (row: ShareRow) => ({
  id: row.id,
  token: row.token,
  permission: row.permission,
  label: row.label,
  bucketName: row.bucket_name,
  fileId: row.file_id,
  fileName: row.original_name,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  path: `/share/${row.token}`
});

const SHARE_SELECT = `
  SELECT s.id, s.token, s.permission, s.label, s.expires_at, s.created_at,
         s.file_id, b.name AS bucket_name, f.original_name
  FROM shares s
  JOIN buckets b ON b.id = s.bucket_id
  LEFT JOIN files f ON f.id = s.file_id
`;

// ---------------------------------------------------------------------------
// Dashboard management (superadmin only)
// ---------------------------------------------------------------------------

export async function listShares(req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await getDb().all<ShareRow[]>(`${SHARE_SELECT} ORDER BY s.created_at DESC`);
    res.json(rows.map(toShareDto));
  } catch (error) {
    console.error('List shares error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function createShare(req: AuthenticatedRequest, res: Response) {
  const { bucketName, fileId, permission = 'viewer', label, expiresInDays } = req.body;

  if (!bucketName || typeof bucketName !== 'string') {
    return res.status(400).json({ error: 'Bucket name is required.' });
  }

  if (!PERMISSIONS.includes(permission)) {
    return res.status(400).json({ error: `Permission must be one of: ${PERMISSIONS.join(', ')}.` });
  }

  let expiryDate: Date | null = null;
  if (expiresInDays !== undefined && expiresInDays !== null && expiresInDays !== '') {
    const days = Number(expiresInDays);
    if (!Number.isFinite(days) || days <= 0 || days > MAX_EXPIRY_DAYS) {
      return res.status(400).json({ error: `Expiry must be between 1 and ${MAX_EXPIRY_DAYS} days.` });
    }
    expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  try {
    const db = getDb();
    // Each engine binds DATETIME differently, so let the driver decide.
    const expiresAt = expiryDate ? db.toTimestamp(expiryDate) : null;
    const bucket = await db.get('SELECT id FROM buckets WHERE name = ?', [bucketName]);

    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    if (fileId) {
      const file = await db.get('SELECT id FROM files WHERE id = ? AND bucket_id = ?', [fileId, bucket.id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found in this bucket.' });
      }
    }

    const id = uuidv4();
    // A share link is a capability URL: the token in the address bar is the
    // whole credential, so it must be long enough to be unguessable.
    const token = crypto.randomBytes(24).toString('base64url');

    await db.run(
      `INSERT INTO shares (id, token, bucket_id, file_id, permission, label, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, token, bucket.id, fileId || null, permission, label || null, expiresAt]
    );

    const created = await db.get<ShareRow>(`${SHARE_SELECT} WHERE s.id = ?`, [id]);
    res.status(201).json({ ...toShareDto(created!), message: 'Tautan berbagi berhasil dibuat.' });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateShare(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { permission, label } = req.body;

  if (permission !== undefined && !PERMISSIONS.includes(permission)) {
    return res.status(400).json({ error: `Permission must be one of: ${PERMISSIONS.join(', ')}.` });
  }

  try {
    const db = getDb();
    const existing = await db.get('SELECT id FROM shares WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (permission !== undefined) {
      updates.push('permission = ?');
      params.push(permission);
    }
    if (label !== undefined) {
      updates.push('label = ?');
      params.push(label || null);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.run(`UPDATE shares SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await db.get<ShareRow>(`${SHARE_SELECT} WHERE s.id = ?`, [id]);
    res.json({ ...toShareDto(updated!), message: 'Tautan berbagi diperbarui.' });
  } catch (error) {
    console.error('Update share error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteShare(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const db = getDb();
    const existing = await db.get('SELECT id FROM shares WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    await db.run('DELETE FROM shares WHERE id = ?', [id]);
    res.json({ message: 'Tautan berbagi telah dicabut.' });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// ---------------------------------------------------------------------------
// Public endpoints — no login, the token in the URL is the only credential
// ---------------------------------------------------------------------------

export function getSharedInfo(req: ShareRequest, res: Response) {
  const share = req.share!;

  res.json({
    permission: share.permission,
    bucketName: share.bucketName,
    label: share.label,
    scope: share.fileId ? 'file' : 'bucket',
    expiresAt: share.expiresAt
  });
}

export async function listSharedFiles(req: ShareRequest, res: Response) {
  const share = req.share!;

  try {
    res.json(await listBucketFiles(share.bucketId, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 24,
      search: (req.query.search as string) || '',
      fileId: share.fileId,
      // Flat on purpose: a link handed out before folders existed showed every
      // file in the bucket, and it still does. Folder navigation on a public
      // page would also leak the folder names of a bucket-wide link.
      flat: true
    }));
  } catch (error) {
    console.error('List shared files error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function uploadSharedFile(req: ShareRequest, res: Response) {
  const share = req.share!;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // A link scoped to one file is a pointer to that file, not a drop box.
  if (share.fileId) {
    discardTempUpload(file);
    return res.status(403).json({ error: 'Tautan ini hanya berlaku untuk satu berkas.' });
  }

  try {
    const stored = await storeUploadedFile(share.bucketId, share.bucketName, file);
    res.status(201).json({ ...stored, message: 'Berkas berhasil diunggah.' });
  } catch (error) {
    discardTempUpload(file);

    if (error instanceof QuotaExceededError) {
      return res.status(413).json({ error: error.detail });
    }

    console.error('Shared upload error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteSharedFile(req: ShareRequest, res: Response) {
  const share = req.share!;
  const { fileId } = req.params;

  if (!assertShareCoversFile(share, fileId)) {
    return res.status(403).json({ error: 'Berkas ini di luar cakupan tautan.' });
  }

  try {
    const removed = await removeBucketFile(share.bucketId, fileId);
    if (!removed) {
      return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
    }

    res.json({ message: 'Berkas berhasil dihapus.' });
  } catch (error) {
    console.error('Shared delete error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
