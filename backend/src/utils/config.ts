import dotenv from 'dotenv';
import path from 'path';

// Loaded here (instead of in server.ts) so that every module reading process.env
// at import time sees the .env values — ES module imports are evaluated before
// the importing module's own body runs.
dotenv.config();

export const PORT = Number(process.env.PORT) || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || 'gentan-secret-key-123456';
export const JWT_EXPIRES_IN = '7d';
/**
 * '*' (default) or a comma-separated allowlist, e.g.
 * "https://storage.example.com,http://192.168.111.5:5000".
 */
export const CORS_ORIGIN: string | string[] = (() => {
  const raw = (process.env.CORS_ORIGIN || '*').trim();
  if (raw === '*') return '*';

  const origins = raw.split(',').map(origin => origin.trim()).filter(Boolean);
  return origins.length > 1 ? origins : origins[0] || '*';
})();
/**
 * Filesystem whose capacity the dashboard reports. Point this at the mount that
 * actually holds the objects (for MinIO, the volume directory) — otherwise the
 * app data partition is reported, which can be a much smaller disk.
 */
export const DISK_REPORT_PATH = process.env.DISK_REPORT_PATH || '';
// --- Database -------------------------------------------------------------
/** 'sqlite' (default, zero setup) or 'mysql'. */
export const DB_CLIENT = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
export const DB_HOST = process.env.DB_HOST || '127.0.0.1';
export const DB_PORT = Number(process.env.DB_PORT) || 3306;
export const DB_USER = process.env.DB_USER || 'root';
export const DB_PASSWORD = process.env.DB_PASSWORD || '';
export const DB_NAME = process.env.DB_NAME || 'gentan_storage';
/** Only used when DB_CLIENT is 'sqlite'. */
export const SQLITE_FILE = process.env.SQLITE_FILE || path.resolve('data', 'database.sqlite');

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 500 * 1024 * 1024;
