import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Define directories
const dataDir = path.resolve('data');
const storageDir = path.join(dataDir, 'storage');

// Configure Multer disk storage
const storage = multer.diskStorage({
  destination: async (req: Request, file, cb) => {
    const { bucketName } = req.params;
    try {
      const db = getDb();
      const bucket = await db.get('SELECT id FROM buckets WHERE name = ?', [bucketName]);
      if (!bucket) {
        return cb(new Error('Bucket not found'), '');
      }
      
      const destPath = path.join(storageDir, bucket.id);
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      cb(null, destPath);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    // Keep it generic to prevent directory traversal
    cb(null, `${fileId}.dat`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB limit (can be configured)
  }
});

export async function listFiles(req: AuthenticatedRequest, res: Response) {
  const { bucketName } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * limit;

  try {
    const db = getDb();
    const bucket = await db.get('SELECT id, is_public FROM buckets WHERE name = ?', [bucketName]);
    
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    // Check privacy authorization
    const isPublic = Boolean(bucket.is_public);
    if (!isPublic && !req.user && !req.apiKeyName) {
      return res.status(403).json({ error: 'Forbidden: Access to private bucket is restricted.' });
    }

    let filesQuery = 'SELECT id, name, original_name, mime_type, size, created_at FROM files WHERE bucket_id = ?';
    const params: any[] = [bucket.id];

    if (search) {
      filesQuery += ' AND original_name LIKE ?';
      params.push(`%${search}%`);
    }

    filesQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const files = await db.all(filesQuery, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM files WHERE bucket_id = ?';
    const countParams: any[] = [bucket.id];
    if (search) {
      countQuery += ' AND original_name LIKE ?';
      countParams.push(`%${search}%`);
    }
    const totalCount = await db.get(countQuery, countParams);

    res.json({
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        originalName: f.original_name,
        mimeType: f.mime_type,
        size: f.size,
        createdAt: f.created_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount?.count || 0,
        pages: Math.ceil((totalCount?.count || 0) / limit)
      }
    });
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
      // Cleanup uploaded file from disk if bucket doesn't exist
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    const fileId = path.basename(file.filename, '.dat');
    // Sanitize user name for URL safety
    const safeName = encodeURIComponent(file.originalname.replace(/\s+/g, '-'));

    await db.run(
      `INSERT INTO files (id, bucket_id, name, original_name, mime_type, size, physical_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fileId, bucket.id, safeName, file.originalname, file.mimetype, file.size, file.path]
    );

    res.status(201).json({
      id: fileId,
      name: safeName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      createdAt: new Date().toISOString(),
      url: `/s/${bucketName}/${safeName}?id=${fileId}`,
      message: 'File uploaded successfully.'
    });
  } catch (error) {
    console.error('Upload file error:', error);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function downloadFile(req: Request, res: Response) {
  const { bucketName, filename } = req.params;
  const fileId = req.query.id as string;

  try {
    const db = getDb();
    const bucket = await db.get('SELECT id, is_public FROM buckets WHERE name = ?', [bucketName]);
    
    if (!bucket) {
      return res.status(404).json({ error: 'Bucket not found.' });
    }

    // Retrieve file metadata from DB
    let fileRecord;
    if (fileId) {
      fileRecord = await db.get(
        'SELECT * FROM files WHERE id = ? AND bucket_id = ?',
        [fileId, bucket.id]
      );
    } else {
      fileRecord = await db.get(
        'SELECT * FROM files WHERE name = ? AND bucket_id = ? ORDER BY created_at DESC LIMIT 1',
        [filename, bucket.id]
      );
    }

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Check privacy rules.
    const isPublic = Boolean(bucket.is_public);
    if (!isPublic) {
      // Check auth manually within download endpoint for media players compatibility
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      const apiKey = (req.headers['x-api-key'] || req.query.api_key) as string;
      
      let authenticated = false;
      const JWT_SECRET = process.env.JWT_SECRET || 'gentan-secret-key-123456';

      // 1. JWT validation
      const token = authHeader ? authHeader.split(' ')[1] : queryToken;
      if (token) {
        try {
          jwt.verify(token, JWT_SECRET);
          authenticated = true;
        } catch (_) {}
      }

      // 2. API Key validation
      if (!authenticated && apiKey) {
        try {
          const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
          const keyRecord = await db.get('SELECT * FROM api_keys WHERE key_hash = ?', [hash]);
          if (keyRecord) {
            authenticated = true;
          }
        } catch (_) {}
      }

      if (!authenticated) {
        return res.status(403).json({ error: 'Forbidden: Access to private resource is restricted.' });
      }
    }

    const physicalPath = fileRecord.physical_path;
    if (!fs.existsSync(physicalPath)) {
      return res.status(404).json({ error: 'Physical file not found on disk.' });
    }

    const fileSize = fileRecord.size;
    const mimeType = fileRecord.mime_type;

    // Handle range headers for streaming audio/video (HTTP 206 Partial Content)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`
        });
        return;
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(physicalPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileRecord.original_name}"`
      });

      fileStream.pipe(res);
    } else {
      // Standard full download/view stream
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileRecord.original_name}"`
      });

      fs.createReadStream(physicalPath).pipe(res);
    }
  } catch (error) {
    console.error('Download/stream file error:', error);
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

    const fileRecord = await db.get(
      'SELECT * FROM files WHERE id = ? AND bucket_id = ?',
      [fileId, bucket.id]
    );

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Delete physically from disk
    if (fs.existsSync(fileRecord.physical_path)) {
      fs.unlinkSync(fileRecord.physical_path);
    }

    // Delete from database
    await db.run('DELETE FROM files WHERE id = ?', [fileId]);

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
