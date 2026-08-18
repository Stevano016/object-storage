import dotenv from 'dotenv';

// Loaded here (instead of in server.ts) so that every module reading process.env
// at import time sees the .env values — ES module imports are evaluated before
// the importing module's own body runs.
dotenv.config();

export const PORT = Number(process.env.PORT) || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || 'gentan-secret-key-123456';
export const JWT_EXPIRES_IN = '7d';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
/**
 * Filesystem whose capacity the dashboard reports. Point this at the mount that
 * actually holds the objects (for MinIO, the volume directory) — otherwise the
 * app data partition is reported, which can be a much smaller disk.
 */
export const DISK_REPORT_PATH = process.env.DISK_REPORT_PATH || '';
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 500 * 1024 * 1024;
