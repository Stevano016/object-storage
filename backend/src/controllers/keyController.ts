import { Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../utils/db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function listAPIKeys(req: AuthenticatedRequest, res: Response) {
  try {
    const db = getDb();
    // Retrieve key details without hashes for security reasons
    const keys = await db.all('SELECT id, name, created_at FROM api_keys ORDER BY created_at DESC');
    
    res.json(keys.map(k => ({
      id: k.id,
      name: k.name,
      createdAt: k.created_at
    })));
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function createAPIKey(req: AuthenticatedRequest, res: Response) {
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Key name is required.' });
  }

  try {
    const db = getDb();
    
    // Generate a secure raw API key
    const rawKey = `gentan_${crypto.randomBytes(24).toString('hex')}`;
    // Compute SHA-256 hash to store in the database
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    const keyId = uuidv4();

    await db.run(
      'INSERT INTO api_keys (id, name, key_hash) VALUES (?, ?, ?)',
      [keyId, name, keyHash]
    );

    // Return the raw key to the client exactly ONCE. It cannot be recovered later!
    res.status(201).json({
      id: keyId,
      name,
      apiKey: rawKey,
      message: 'API Key generated successfully. Save it now, you will not be able to see it again!'
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteAPIKey(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const db = getDb();
    
    const keyRecord = await db.get('SELECT * FROM api_keys WHERE id = ?', [id]);
    if (!keyRecord) {
      return res.status(404).json({ error: 'API Key not found.' });
    }

    await db.run('DELETE FROM api_keys WHERE id = ?', [id]);

    res.json({ message: `API Key '${keyRecord.name}' revoked successfully.` });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
