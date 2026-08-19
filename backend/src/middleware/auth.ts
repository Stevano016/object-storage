import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb, UserRole } from '../utils/db.js';
import { JWT_SECRET } from '../utils/config.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  apiKeyName?: string;
}

/**
 * API routes take the session token from the Authorization header only.
 *
 * A token in the query string ends up in the Apache access log, in Cloudflare's
 * request log and in any Referer the page sends onward. The streaming endpoint
 * under /s/ still accepts ?token= because <video> and <img> cannot send headers,
 * and it authorizes that separately.
 */
function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
}

function extractApiKey(req: Request): string | undefined {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string') return headerKey;
  return typeof req.query.api_key === 'string' ? req.query.api_key : undefined;
}

/**
 * Verifies a dashboard JWT and re-reads the account from the database, so a
 * role change or a deleted account takes effect immediately instead of waiting
 * for the 7-day token to expire.
 */
async function resolveJwtUser(token: string): Promise<AuthenticatedUser | null> {
  let payload: { id?: string; iat?: number };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id?: string; iat?: number };
  } catch {
    return null;
  }

  if (!payload.id) return null;

  const row = await getDb().get(
    'SELECT id, username, role, password_changed_at FROM users WHERE id = ?',
    [payload.id]
  );
  if (!row) return null;

  // A password change revokes every token issued before it, which is the only
  // way to boot an attacker who already holds a stolen session.
  if (row.password_changed_at && payload.iat) {
    const changedAt = new Date(row.password_changed_at).getTime();
    // One second of slack: `iat` is whole seconds, the column is sub-second.
    if (Number.isFinite(changedAt) && payload.iat * 1000 < changedAt - 1000) {
      return null;
    }
  }

  return { id: row.id, username: row.username, role: row.role as UserRole };
}

async function resolveApiKeyName(apiKey: string): Promise<string | null> {
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await getDb().get('SELECT name FROM api_keys WHERE key_hash = ?', [hash]);
  return keyRecord ? keyRecord.name : null;
}

/** Dashboard-only routes: a valid JWT is required. */
export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token or token query parameter is missing.' });
  }

  try {
    const user = await resolveJwtUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('JWT authentication error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** Programmatic routes: only an API key is accepted. */
export async function authenticateAPIKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: API Key is missing.' });
  }

  try {
    const keyName = await resolveApiKeyName(apiKey);
    if (!keyName) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key.' });
    }
    req.apiKeyName = keyName;
    next();
  } catch (error) {
    console.error('API Key authentication error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** Accepts either a dashboard JWT or an API key (file listing, upload, delete). */
export async function authenticateFlexible(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const apiKey = extractApiKey(req);

  if (!token && !apiKey) {
    return res.status(401).json({ error: 'Unauthorized: Neither a Bearer JWT nor an API Key was provided.' });
  }

  try {
    if (token) {
      const user = await resolveJwtUser(token);
      if (user) {
        req.user = user;
        return next();
      }
      if (!apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
      }
    }

    const keyName = apiKey ? await resolveApiKeyName(apiKey) : null;
    if (!keyName) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key.' });
    }
    req.apiKeyName = keyName;
    next();
  } catch (error) {
    console.error('Flexible authentication error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** Destructive / administrative routes: superadmin accounts only. */
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden: This action requires a superadmin account.' });
  }
  next();
}

/**
 * Same as requireSuperAdmin, but also lets programmatic API keys through — they
 * are issued by a superadmin and are the only way scripts can clean up files.
 */
export function requireSuperAdminOrApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.apiKeyName || req.user?.role === 'superadmin') {
    return next();
  }
  res.status(403).json({ error: 'Forbidden: Regular users can upload and view files, but not delete them.' });
}
