import { Request, Response } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveShareToken } from '../middleware/share.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { getStorageProvider } from '../utils/storageProvider.js';
import { MAX_UPLOAD_BYTES, JWT_SECRET } from '../utils/config.js';

// Define directories
const dataDir = path.resolve('data');
const tempDir = path.join(dataDir, 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure Multer temp landing storage
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    cb(null, `${fileId}.dat`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

export interface FileDto {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ListOptions {
  page: number;
  limit: number;
  search: string;
  /** Restricts the listing to a single file, for file-scoped share links. */
  fileId?: string | null;
}

const toFileDto = (row: any): FileDto => ({
  id: row.id,
  name: row.name,
  originalName: row.original_name,
  mimeType: row.mime_type,
  size: row.size,
  createdAt: row.created_at
});

// ---------------------------------------------------------------------------
// Storage services — shared by the authenticated dashboard API and the public
// share-link API, so both paths behave identically.
// ---------------------------------------------------------------------------

export async function listBucketFiles(bucketId: string, options: ListOptions) {
  const db = getDb();
  const { page, limit, search, fileId } = options;
  const offset = (page - 1) * limit;

  const filters = ['bucket_id = ?'];
  const params: any[] = [bucketId];

  if (fileId) {
    filters.push('id = ?');
    params.push(fileId);
  }
  if (search) {
    filters.push('original_name LIKE ?');
    params.push(`%${search}%`);
  }

  const where = filters.join(' AND ');

  const rows = await db.all(
    `SELECT id, name, original_name, mime_type, size, created_at
     FROM files WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRow = await db.get(`SELECT COUNT(*) as count FROM files WHERE ${where}`, params);
  const total = totalRow?.count || 0;

  return {
    files: rows.map(toFileDto),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

export async function storeUploadedFile(
  bucketId: string,
  bucketName: string,
  file: Express.Multer.File
): Promise<FileDto & { url: string }> {
  const db = getDb();
  const fileId = path.basename(file.filename, '.dat');
  // Sanitize the display name so it is safe inside a URL path.
  const safeName = encodeURIComponent(file.originalname.replace(/\s+/g, '-'));

  const storagePath = await getStorageProvider().uploadFile(bucketId, fileId, file.path, file.mimetype);

  await db.run(
    `INSERT INTO files (id, bucket_id, name, original_name, mime_type, size, physical_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fileId, bucketId, safeName, file.originalname, file.mimetype, file.size, storagePath]
  );

  return {
    id: fileId,
    name: safeName,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    createdAt: new Date().toISOString(),
    url: `/s/${bucketName}/${safeName}?id=${fileId}`
  };
}

export async function removeBucketFile(bucketId: string, fileId: string): Promise<boolean> {
  const db = getDb();
  const fileRecord = await db.get('SELECT id FROM files WHERE id = ? AND bucket_id = ?', [fileId, bucketId]);

  if (!fileRecord) return false;

  await getStorageProvider().deleteFile(bucketId, fileRecord.id);
  await db.run('DELETE FROM files WHERE id = ?', [fileId]);
  return true;
}

/** Removes a temp upload that never made it into storage. */
export function discardTempUpload(file?: Express.Multer.File) {
  if (file && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

// ---------------------------------------------------------------------------
// Dashboard / API-key endpoints
// ---------------------------------------------------------------------------

export async function listFiles(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;

  try {
    const db = getDb();
    const bucket = await db.get('SELECT id, is_public FROM buckets WHERE name = ?', [bucketName]);

    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    if (!bucket.is_public && !req.user && !req.apiKeyName) {
      return res.status(403).json({ error: 'Forbidden: Access to private bucket is restricted.' });
    }

    res.json(await listBucketFiles(bucket.id, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      search: (req.query.search as string) || ''
    }));
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function uploadFile(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const db = getDb();
    const bucket = await db.get('SELECT id FROM buckets WHERE name = ?', [bucketName]);

    if (!bucket) {
      discardTempUpload(file);
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const stored = await storeUploadedFile(bucket.id, bucketName, file);
    res.status(201).json({ ...stored, message: 'File uploaded successfully.' });
  } catch (error) {
    console.error('Upload file error:', error);
    discardTempUpload(file);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteFile(req: AuthenticatedRequest, res: Response) {
  const { bucketName, fileId } = req.params;

  try {
    const db = getDb();
    const bucket = await db.get('SELECT id FROM buckets WHERE name = ?', [bucketName]);

    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const removed = await removeBucketFile(bucket.id, fileId);
    if (!removed) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// ---------------------------------------------------------------------------
// Streaming endpoint (authorizes internally so media players can hit it directly)
// ---------------------------------------------------------------------------

async function isRequestAuthorized(req: Request, bucketId: string, fileId: string): Promise<boolean> {
  const db = getDb();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string);

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch {
      // Fall through to the other credential types.
    }
  }

  const apiKey = (req.headers['x-api-key'] || req.query.api_key) as string | undefined;
  if (apiKey) {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = await db.get('SELECT id FROM api_keys WHERE key_hash = ?', [hash]);
    if (keyRecord) return true;
  }

  // Share links: valid only for their own bucket, and for their own file when
  // the link was scoped to a single file.
  const shareToken = req.query.share as string | undefined;
  if (shareToken) {
    const share = await resolveShareToken(shareToken);
    if (share && share.bucketId === bucketId && (!share.fileId || share.fileId === fileId)) {
      return true;
    }
  }

  return false;
}

export async function downloadFile(req: Request, res: Response) {
  const { bucketName, filename } = req.params;
  const fileId = req.query.id as string;
  const forceDownload = req.query.download === '1';

  try {
    const db = getDb();
    const bucket = await db.get('SELECT id, is_public FROM buckets WHERE name = ?', [bucketName]);

    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const fileRecord = fileId
      ? await db.get('SELECT * FROM files WHERE id = ? AND bucket_id = ?', [fileId, bucket.id])
      : await db.get(
          'SELECT * FROM files WHERE name = ? AND bucket_id = ? ORDER BY created_at DESC LIMIT 1',
          [filename, bucket.id]
        );

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    if (!bucket.is_public && !(await isRequestAuthorized(req, bucket.id, fileRecord.id))) {
      return res.status(403).json({ error: 'Forbidden: Access to private resource is restricted.' });
    }

    const fileSize = fileRecord.size;
    const disposition = forceDownload ? 'attachment' : 'inline';

    // Handle range headers for streaming audio/video (HTTP 206 Partial Content)
    const rangeHeader = req.headers.range;
    let range: { start: number; end: number } | undefined;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({ 'Content-Range': `bytes */${fileSize}` });
        return;
      }
      range = { start, end };
    }

    try {
      const storageResult = await getStorageProvider().getFileStream(bucket.id, fileRecord.id, range);

      if (range) {
        res.writeHead(206, {
          'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': storageResult.size,
          'Content-Type': fileRecord.mime_type,
          'Content-Disposition': `${disposition}; filename="${fileRecord.original_name}"`
        });
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': fileRecord.mime_type,
          'Content-Disposition': `${disposition}; filename="${fileRecord.original_name}"`
        });
      }

      storageResult.stream.pipe(res);
    } catch (err) {
      console.error('File stream error:', err);
      res.status(404).json({ error: 'Physical file not found.' });
    }
  } catch (error) {
    console.error('Download/stream file error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
