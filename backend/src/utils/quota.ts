import { getDb } from './db.js';

/** A quota below this is a typo, not an intention. */
export const MIN_QUOTA_BYTES = 1024 * 1024;
/** 1 PiB — high enough to never be a real ceiling, low enough to catch garbage. */
export const MAX_QUOTA_BYTES = 1024 ** 5;

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** Byte counts for humans, matching how the dashboard prints them. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${parseFloat(value.toFixed(2))} ${SIZE_UNITS[exponent]}`;
}

export type QuotaParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Reads a quota off a request body.
 *
 * `null`, an empty string and 0 all mean "unlimited" — the dashboard sends
 * whichever is most natural for an emptied field, and treating them the same
 * avoids a bucket accidentally getting a 0-byte ceiling.
 */
export function parseQuotaBytes(input: unknown): QuotaParseResult {
  if (input === undefined || input === null || input === '' || input === 0) {
    return { ok: true, value: null };
  }

  const value = typeof input === 'string' ? Number(input) : input;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: 'Kuota harus berupa angka byte.' };
  }
  if (value < 0) {
    return { ok: false, error: 'Kuota tidak boleh negatif.' };
  }
  if (value > 0 && value < MIN_QUOTA_BYTES) {
    return { ok: false, error: `Kuota minimum ${formatBytes(MIN_QUOTA_BYTES)}.` };
  }
  if (value > MAX_QUOTA_BYTES) {
    return { ok: false, error: `Kuota maksimum ${formatBytes(MAX_QUOTA_BYTES)}.` };
  }

  return { ok: true, value: Math.floor(value) };
}

/** Bytes currently stored in a bucket, from the file metadata. */
export async function getBucketUsage(bucketId: string): Promise<number> {
  const row = await getDb().get(
    'SELECT COALESCE(SUM(size), 0) AS used FROM files WHERE bucket_id = ?',
    [bucketId]
  );
  return Number(row?.used || 0);
}

export class QuotaExceededError extends Error {
  constructor(
    readonly quotaBytes: number,
    readonly usedBytes: number,
    readonly incomingBytes: number
  ) {
    super('Bucket quota exceeded.');
    this.name = 'QuotaExceededError';
  }

  /** The message the dashboard and share pages show verbatim. */
  get detail(): string {
    const remaining = Math.max(0, this.quotaBytes - this.usedBytes);
    return `Kuota bucket tinggal ${formatBytes(remaining)} dari ${formatBytes(this.quotaBytes)}, `
      + `sedangkan berkas ini ${formatBytes(this.incomingBytes)}. `
      + 'Hapus berkas lama atau naikkan kuota bucket.';
  }
}

/**
 * Throws when storing `incomingBytes` more would put the bucket over its quota.
 *
 * The check is read-then-write, so two uploads racing each other can both pass
 * and land slightly over the ceiling. Locking the bucket for every upload would
 * cost more than the overshoot is worth: the next upload sees the real total and
 * is refused, so the quota holds as a ceiling rather than a hard byte boundary.
 */
export async function assertBucketQuota(bucketId: string, incomingBytes: number): Promise<void> {
  const bucket = await getDb().get('SELECT quota_bytes FROM buckets WHERE id = ?', [bucketId]);
  const quota = Number(bucket?.quota_bytes || 0);

  if (!quota) return;

  const used = await getBucketUsage(bucketId);
  if (used + incomingBytes > quota) {
    throw new QuotaExceededError(quota, used, incomingBytes);
  }
}
