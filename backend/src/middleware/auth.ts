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

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return typeof req.query.token === 'string' ? req.query.token : undefined;
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
  let payload: { id?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id?: string };
  } catch {
    return null;
  }

  if (!payload.id) return null;

  const row = await getDb().get('SELECT id, username, role FROM users WHERE id = ?', [payload.id]);
  if (!row) return null;

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
