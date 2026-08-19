import { Response } from 'express';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getStorageProvider } from '../utils/storageProvider.js';
import { getBucketUsage, parseQuotaBytes } from '../utils/quota.js';

export async function listBuckets(req: AuthenticatedRequest, res: Response) {
  try {
    const db = getDb();
    
    // Select all buckets along with the file counts and total files sizes in bytes
    const query = `
      SELECT 
        b.id, 
        b.name, 
        b.is_public, 
        b.quota_bytes,
        b.created_at,
        COUNT(f.id) as file_count,
        COALESCE(SUM(f.size), 0) as total_size
      FROM buckets b
      LEFT JOIN files f ON b.id = f.bucket_id
      GROUP BY b.id, b.name, b.is_public, b.quota_bytes, b.created_at
      ORDER BY b.name ASC
    `;
    
    const buckets = await db.all(query);
    
    res.json(buckets.map(b => ({
      id: b.id,
      name: b.name,
      isPublic: Boolean(b.is_public),
      createdAt: b.created_at,
      fileCount: b.file_count,
      totalSize: b.total_size,
      // null means unlimited; the dashboard renders a usage bar only when set.
      quotaBytes: b.quota_bytes ? Number(b.quota_bytes) : null
    })));
  } catch (error) {
    console.error('List buckets error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function createBucket(req: AuthenticatedRequest, res: Response) {
  const { name, isPublic, quotaBytes } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Bucket name is required.' });
  }

  // Sanitize bucket name (lowercase, alphanumeric and hyphens only, length between 3-63)
  const bucketNameRegex = /^[a-z0-9-]{3,63}$/;
  if (!bucketNameRegex.test(name)) {
    return res.status(400).json({ 
      error: 'Invalid bucket name. It must be lowercase, alphanumeric or hyphens, and 3-63 characters long.' 
    });
  }

  const quota = parseQuotaBytes(quotaBytes);
  if (!quota.ok) {
    return res.status(400).json({ error: quota.error });
  }

  try {
    const db = getDb();
    
    // Check if bucket already exists
    const existing = await db.get('SELECT id FROM buckets WHERE name = ?', [name]);
    if (existing) {
      return res.status(409).json({ error: 'A bucket with this name already exists.' });
    }

    const bucketId = uuidv4();
    const isPublicInt = isPublic ? 1 : 0;

    await db.run(
      'INSERT INTO buckets (id, name, is_public, quota_bytes) VALUES (?, ?, ?, ?)',
      [bucketId, name, isPublicInt, quota.value]
    );

    // Create via storage provider (local disk or MinIO S3)
    await getStorageProvider().createBucket(bucketId);

    res.status(201).json({
      id: bucketId,
      name,
      isPublic: Boolean(isPublicInt),
      quotaBytes: quota.value,
      message: 'Bucket created successfully.'
    });
  } catch (error) {
    console.error('Create bucket error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteBucket(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;

  try {
    const db = getDb();
    
    const bucket = await db.get('SELECT * FROM buckets WHERE name = ?', [bucketName]);
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    // Get all files in this bucket to delete them physically first
    const files = await db.all('SELECT id FROM files WHERE bucket_id = ?', [bucket.id]);
    
    // Delete files physically via storage provider
    const storage = getStorageProvider();
    for (const file of files) {
      await storage.deleteFile(bucket.id, file.id);
    }

    // Delete bucket directory via storage provider
    await storage.deleteBucket(bucket.id);

    // Delete from DB (foreign keys ON DELETE CASCADE will handle the database rows)
    await db.run('DELETE FROM buckets WHERE id = ?', [bucket.id]);

    res.json({ message: `Bucket '${bucketName}' and all its contents deleted successfully.` });
  } catch (error) {
    console.error('Delete bucket error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateBucket(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;
  const { isPublic, quotaBytes } = req.body;

  // A partial update: the visibility toggle and the quota dialog each send only
  // the field they own, so an absent field must keep its stored value.
  if (isPublic === undefined && quotaBytes === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: isPublic, quotaBytes.' });
  }

  const quota = quotaBytes === undefined ? null : parseQuotaBytes(quotaBytes);
  if (quota && !quota.ok) {
    return res.status(400).json({ error: quota.error });
  }

  try {
    const db = getDb();
    const bucket = await db.get('SELECT * FROM buckets WHERE name = ?', [bucketName]);
    
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (isPublic !== undefined) {
      updates.push('is_public = ?');
      params.push(isPublic ? 1 : 0);
    }
    if (quota) {
      updates.push('quota_bytes = ?');
      params.push(quota.value);
    }

    await db.run(`UPDATE buckets SET ${updates.join(', ')} WHERE id = ?`, [...params, bucket.id]);

    const nextIsPublic = isPublic === undefined ? Boolean(bucket.is_public) : Boolean(isPublic);
    const nextQuota = quota ? quota.value : (bucket.quota_bytes ? Number(bucket.quota_bytes) : null);

    res.json({
      id: bucket.id,
      name: bucketName,
      isPublic: nextIsPublic,
      quotaBytes: nextQuota,
      // Lets the dashboard say "the new ceiling is already exceeded" instead of
      // waiting for the next upload to fail.
      usedBytes: await getBucketUsage(bucket.id),
      message: 'Bucket settings updated successfully.'
    });
  } catch (error) {
    console.error('Update bucket error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
