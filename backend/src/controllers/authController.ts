import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { getDb, hashPassword, BCRYPT_ROUNDS, DEFAULT_ADMIN_PASSWORD } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { JWT_SECRET, JWT_EXPIRES_IN, DISK_REPORT_PATH } from '../utils/config.js';
import { clientIp, RateLimiter } from '../utils/security.js';
import { validatePasswordStrength } from '../utils/password.js';

/**
 * Two counters, because they stop different attacks — and they stop them
 * differently on purpose.
 *
 * The per-address one blocks: a host that has failed 15 times in five minutes is
 * guessing, and locking it out costs only that host.
 *
 * The per-username one never blocks, it only adds delay. Blocking by username
 * would hand an attacker a way to lock the admin out of their own dashboard on
 * demand; a delay that grows with each failure makes a botnet spread across
 * thousands of addresses just as impractical, without ever closing the door on
 * the real owner.
 */
const loginByAddress = new RateLimiter({ windowMs: 5 * 60_000, max: 15, blockMs: 15 * 60_000 });
const loginFailuresByUsername = new RateLimiter({
  windowMs: 15 * 60_000,
  max: Number.POSITIVE_INFINITY,
  blockMs: 0
});

const MAX_LOGIN_DELAY_MS = 4_000;
const DELAY_PER_FAILURE_MS = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Compared against when the username does not exist, so a wrong username and a
 * wrong password take the same time to answer. Without it, response latency
 * tells an attacker which accounts are worth attacking.
 */
const TIMING_EQUALIZER_HASH = bcrypt.hashSync('gentan-timing-equalizer', BCRYPT_ROUNDS);

function issueToken(user: { id: string; username: string; role: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function login(req: AuthenticatedRequest, res: Response) {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const address = clientIp(req);
  const account = username.trim().toLowerCase();

  const blockedFor = loginByAddress.retryAfter(address);
  if (blockedFor > 0) {
    res.setHeader('Retry-After', String(blockedFor));
    return res.status(429).json({
      error: `Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam ${blockedFor} detik.`
    });
  }

  // Paid before the password is checked, so the delay also applies to whoever is
  // working through a list of candidate passwords for this account.
  const priorFailures = loginFailuresByUsername.hits(account);
  if (priorFailures > 0) {
    await sleep(Math.min(priorFailures * DELAY_PER_FAILURE_MS, MAX_LOGIN_DELAY_MS));
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    const matches = await bcrypt.compare(password, user?.password_hash || TIMING_EQUALIZER_HASH);

    if (!user || !matches) {
      loginByAddress.hit(address);
      loginFailuresByUsername.hit(account);
      console.warn(`Failed login for '${username}' from ${address}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Only a success clears the counters, so a wrong guess never buys credit.
    loginByAddress.reset(address);
    loginFailuresByUsername.reset(account);

    res.json({
      token: issueToken(user),
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

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user?.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const weakness = validatePasswordStrength(newPassword, user.username);
    if (weakness) {
      return res.status(400).json({ error: weakness });
    }

    // Stamping the change is what invalidates tokens issued earlier — including
    // any session an attacker may already be holding.
    const changedAt = new Date();
    await db.run(
      'UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?',
      [await hashPassword(newPassword), db.toTimestamp(changedAt), user.id]
    );

    // The caller's own token was just revoked too, so hand back a fresh one
    // rather than bouncing them to the login screen for doing the right thing.
    res.json({
      message: 'Password updated successfully. Sesi lain telah dikeluarkan.',
      token: issueToken(user)
    });
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
    // bavail excludes blocks reserved for root, while bfree does not — using
    // both keeps "used" honest instead of counting the reserve as consumed.
    return {
      total: stat.blocks * stat.bsize,
      free: stat.bavail * stat.bsize,
      used: (stat.blocks - stat.bfree) * stat.bsize
    };
  } catch {
    return null;
  }
}

/**
 * Is any account still reachable with the password published in the README?
 *
 * Checked live rather than tracked with a flag, because the password can also be
 * changed straight in the database, and a stale flag would either nag forever or
 * go quiet while the hole is still open.
 */
export async function findAccountsUsingDefaultPassword(): Promise<string[]> {
  const users = await getDb().all<{ username: string; password_hash: string }[]>(
    "SELECT username, password_hash FROM users WHERE username != 'root'"
  );

  const stillDefault: string[] = [];
  for (const user of users) {
    if (await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, user.password_hash)) {
      stillDefault.push(user.username);
    }
  }
  return stillDefault;
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const db = getDb();
    const dataDir = path.resolve('data');

    const [bucketCount, fileCount, keyCount, userCount] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM buckets'),
      db.get('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total_size FROM files'),
      db.get('SELECT COUNT(*) as count FROM api_keys'),
      db.get("SELECT COUNT(*) as count FROM users WHERE username != 'root'")
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
      storageProvider: process.env.STORAGE_PROVIDER || 'local',
      // Surfaced in the dashboard as a banner. Only superadmins can act on it,
      // but every account holder deserves to know the instance is wide open.
      accountsUsingDefaultPassword: await findAccountsUsingDefaultPassword()
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
