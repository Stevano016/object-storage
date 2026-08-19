import dotenv from 'dotenv';
import path from 'path';
import type { SignOptions } from 'jsonwebtoken';

// Loaded here (instead of in server.ts) so that every module reading process.env
// at import time sees the .env values — ES module imports are evaluated before
// the importing module's own body runs.
dotenv.config();

export const PORT = Number(process.env.PORT) || 5000;

/**
 * Session-signing key. There is deliberately no fallback: a guessable secret
 * lets anyone mint a superadmin token, and this server is reachable from the
 * public Internet through a Cloudflare Tunnel. Refusing to boot is the only
 * failure mode that cannot be ignored.
 */
const MIN_JWT_SECRET_LENGTH = 32;
/** Values that shipped in the repo, so they must never be accepted. */
const PUBLISHED_SECRETS = new Set([
  'gentan-secret-key-123456',
  'ganti_dengan_nilai_acak_yang_panjang'
]);

function readJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();

  const problem =
    !secret ? 'JWT_SECRET is not set'
    : PUBLISHED_SECRETS.has(secret) ? 'JWT_SECRET still holds the placeholder value from the repository'
    : secret.length < MIN_JWT_SECRET_LENGTH ? `JWT_SECRET is only ${secret.length} characters (minimum ${MIN_JWT_SECRET_LENGTH})`
    : null;

  if (problem) {
    console.error('==================================================');
    console.error(`FATAL: ${problem}.`);
    console.error('Anyone who knows the key can forge a superadmin session.');
    console.error('Generate one and put it in .env, then restart:');
    console.error('  openssl rand -base64 48');
    console.error('==================================================');
    process.exit(1);
  }

  return secret;
}

export const JWT_SECRET = readJwtSecret();
/** Shorter than the old 7 days: a leaked token stays useful for less time. */
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
/**
 * Which upstream hops may set X-Forwarded-For.
 *
 * 'loopback' alone was wrong here: the app runs in a container, so a request
 * forwarded by cloudflared or Apache on the host arrives from the Docker bridge
 * gateway (172.18.0.1), not 127.0.0.1. Express then refused to read the
 * forwarding headers and every visitor on the Internet was accounted for under
 * that single address — which meant the login rate limiter could be tripped for
 * everyone at once by any one of them.
 *
 * 'uniquelocal' covers the private ranges a container gateway can occupy. The
 * container is not itself reachable from the Internet, so the only hosts that
 * can present these headers are on the machine or the LAN.
 */
export const TRUST_PROXY: boolean | number | string = (() => {
  const raw = (process.env.TRUST_PROXY || 'loopback, uniquelocal').trim();
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
})();
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
