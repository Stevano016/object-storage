import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { getDb, hashPassword } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { JWT_SECRET, JWT_EXPIRES_IN, DISK_REPORT_PATH } from '../utils/config.js';

const MIN_PASSWORD_LENGTH = 6;

export async function login(req: AuthenticatedRequest, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** Returns the account behind the current token, so the dashboard can pick up role changes. */
export function me(req: AuthenticatedRequest, res: Response) {
  res.json({ user: req.user });
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` });
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user?.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(newPassword), user.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

function getFolderSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;

  let size = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    size += entry.isDirectory() ? getFolderSize(entryPath) : fs.statSync(entryPath).size;
  }
  return size;
}

/** Real capacity of a mounted filesystem (null if the platform has no statfs). */
function getDiskUsage(target: string): { total: number; free: number; used: number } | null {
  try {
    const stat = fs.statfsSync(target);
    const total = stat.blocks * stat.bsize;
    const free = stat.bavail * stat.bsize;
    return { total, free, used: total - free };
  } catch {
    return null;
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const db = getDb();
    const dataDir = path.resolve('data');

    const [bucketCount, fileCount, keyCount, userCount] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM buckets'),
      db.get('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM files'),
      db.get('SELECT COUNT(*) as count FROM api_keys'),
      db.get('SELECT COUNT(*) as count FROM users')
    ]);

    res.json({
      buckets: bucketCount?.count || 0,
      files: fileCount?.count || 0,
      totalSize: fileCount?.total_size || 0,
      physicalDiskSize: getFolderSize(path.join(dataDir, 'storage')),
      apiKeys: keyCount?.count || 0,
      users: userCount?.count || 0,
      disk: getDiskUsage(DISK_REPORT_PATH || dataDir),
      diskLabel: DISK_REPORT_PATH ? 'Kapasitas penyimpanan objek' : 'Kapasitas partisi data aplikasi',
      storageProvider: process.env.STORAGE_PROVIDER || 'local'
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
