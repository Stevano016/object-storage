import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../utils/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gentan-secret-key-123456';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
  apiKeyName?: string;
}

// Authenticate via JWT (Dashboard Admin users)
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : req.query.token;

  if (token && typeof token === 'string') {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
      }
      req.user = user as { id: string; username: string };
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Bearer token or token query parameter is missing.' });
  }
}

// Authenticate via API Key (For programmatic scripts/API integration)
export async function authenticateAPIKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: API Key is missing.' });
  }

  try {
    const db = getDb();
    // Hash incoming key to check against key_hash
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const keyRecord = await db.get('SELECT * FROM api_keys WHERE key_hash = ?', [hash]);

    if (!keyRecord) {
      return res.status(403).json({ error: 'Forbidden: Invalid API Key.' });
    }

    req.apiKeyName = keyRecord.name;
    next();
  } catch (error) {
    console.error('API Key Authentication Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Flexible auth: allows either JWT or API Key (e.g. for general file lists, bucket operations, etc.)
export async function authenticateFlexible(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : req.query.token;
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (token && typeof token === 'string') {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid token.' });
      }
      req.user = user as { id: string; username: string };
      next();
    });
  } else if (apiKey && typeof apiKey === 'string') {
    try {
      const db = getDb();
      const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyRecord = await db.get('SELECT * FROM api_keys WHERE key_hash = ?', [hash]);

      if (!keyRecord) {
        return res.status(403).json({ error: 'Forbidden: Invalid API Key.' });
      }

      req.apiKeyName = keyRecord.name;
      next();
    } catch (error) {
      console.error('Flexible Authentication Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized: Neither valid Bearer JWT nor API Key was provided.' });
  }
}
