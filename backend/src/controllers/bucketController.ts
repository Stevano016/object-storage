import { Response } from 'express';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getStorageProvider } from '../utils/storageProvider.js';

export async function listBuckets(req: AuthenticatedRequest, res: Response) {
  try {
    const db = getDb();
    
    // Select all buckets along with the file counts and total files sizes in bytes
    const query = `
      SELECT 
        b.id, 
        b.name, 
        b.is_public, 
        b.created_at,
        COUNT(f.id) as file_count,
        COALESCE(SUM(f.size), 0) as total_size
      FROM buckets b
      LEFT JOIN files f ON b.id = f.bucket_id
      GROUP BY b.id, b.name, b.is_public, b.created_at
      ORDER BY b.name ASC
    `;
    
    const buckets = await db.all(query);
    
    res.json(buckets.map(b => ({
      id: b.id,
      name: b.name,
      isPublic: Boolean(b.is_public),
      createdAt: b.created_at,
      fileCount: b.file_count,
      totalSize: b.total_size
    })));
  } catch (error) {
    console.error('List buckets error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function createBucket(req: AuthenticatedRequest, res: Response) {
  const { name, isPublic } = req.body;

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
      'INSERT INTO buckets (id, name, is_public) VALUES (?, ?, ?)',
      [bucketId, name, isPublicInt]
    );

    // Create via storage provider (local disk or MinIO S3)
    await getStorageProvider().createBucket(bucketId);

    res.status(201).json({
      id: bucketId,
      name,
      isPublic: Boolean(isPublicInt),
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
  const { isPublic } = req.body;

  if (isPublic === undefined) {
    return res.status(400).json({ error: 'isPublic field is required for update.' });
  }

  try {
    const db = getDb();
    const bucket = await db.get('SELECT * FROM buckets WHERE name = ?', [bucketName]);
    
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const isPublicInt = isPublic ? 1 : 0;
    await db.run('UPDATE buckets SET is_public = ? WHERE id = ?', [isPublicInt, bucket.id]);

    res.json({
      id: bucket.id,
      name: bucketName,
      isPublic: Boolean(isPublicInt),
      message: 'Bucket settings updated successfully.'
    });
  } catch (error) {
    console.error('Update bucket error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
