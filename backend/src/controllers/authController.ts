import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'gentan-secret-key-123456';
const JWT_EXPIRES_IN = '7d';

export async function login(req: AuthenticatedRequest, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const userId = req.user?.id;

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const db = getDb();

    const bucketCount = await db.get('SELECT COUNT(*) as count FROM buckets');
    const fileCount = await db.get('SELECT COUNT(*) as count, SUM(size) as total_size FROM files');
    const keyCount = await db.get('SELECT COUNT(*) as count FROM api_keys');

    // Get directories sizes
    const storagePath = path.resolve('data', 'storage');
    let physicalSize = 0;

    const getFolderSize = (dirPath: string): number => {
      let size = 0;
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            size += getFolderSize(filePath);
          } else {
            size += stat.size;
          }
        }
      }
      return size;
    };

    if (fs.existsSync(storagePath)) {
      physicalSize = getFolderSize(storagePath);
    }

    res.json({
      buckets: bucketCount?.count || 0,
      files: fileCount?.count || 0,
      totalSize: fileCount?.total_size || 0,
      physicalDiskSize: physicalSize,
      apiKeys: keyCount?.count || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
