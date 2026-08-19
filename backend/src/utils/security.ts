import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Client identity
// ---------------------------------------------------------------------------

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Addresses a forwarding hop can legitimately have: the loopback interface, or
 * a private range — which is what a Docker bridge gateway uses. Anything else
 * is a direct client and may not describe itself.
 */
function isTrustedHop(address: string): boolean {
  const plain = address.replace(/^::ffff:/, '');
  if (LOOPBACK.has(address) || LOOPBACK.has(plain)) return true;

  const octets = plain.split('.').map(Number);
  if (octets.length !== 4 || octets.some(part => Number.isNaN(part))) return false;

  const [a, b] = octets;
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

/**
 * The address to hold accountable for a request.
 *
 * Cloudflare puts the visitor's address in CF-Connecting-IP, but that header is
 * only trustworthy when the request actually arrived through the local Apache
 * proxy — a client on the LAN talking straight to port 5000 could otherwise
 * forge it and get a fresh rate-limit budget on every attempt. Express's own
 * `req.ip` stops at the Cloudflare edge address (the edge is not a trusted hop),
 * which would lump unrelated visitors together, so the header is preferred when
 * it can be believed and ignored when it cannot.
 */
export function clientIp(req: Request): string {
  const peer = req.socket.remoteAddress || '';
  const forwarded = req.headers['cf-connecting-ip'];

  if (isTrustedHop(peer) && typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.trim();
  }

  return req.ip || peer || 'unknown';
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface RateLimiterOptions {
  /** How long attempts are remembered. */
  windowMs: number;
  /**
   * Attempts allowed inside the window before the key is blocked. Pass
   * `Infinity` to only count attempts, which is what the per-username login
   * counter does — see `hits`.
   */
  max: number;
  /** How long a key stays blocked once it trips the limit. */
  blockMs: number;
}

interface Bucket {
  hits: number;
  /** When the current window started, or when the block expires. */
  resetAt: number;
  blocked: boolean;
}

/**
 * A fixed-window counter with a cool-off period, kept in memory.
 *
 * In-process state is the right trade here: this is a single-container server,
 * and a limiter that needs Redis to work is a limiter that silently stops
 * working. State resets on restart, which is acceptable for slowing password
 * guessing down.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimiterOptions) {
    // Unreferenced so it never holds the process open on shutdown.
    setInterval(() => this.sweep(), Math.max(options.windowMs, options.blockMs)).unref();
  }

  private sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Seconds until this key may try again, or 0 when it is not blocked. */
  retryAfter(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket || !bucket.blocked || bucket.resetAt <= Date.now()) return 0;
    return Math.ceil((bucket.resetAt - Date.now()) / 1000);
  }

  /** Records one attempt. Returns 0 when it is allowed, else seconds to wait. */
  hit(key: string): number {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (existing && existing.resetAt > now) {
      if (existing.blocked) {
        return Math.ceil((existing.resetAt - now) / 1000);
      }

      existing.hits += 1;
      if (existing.hits > this.options.max) {
        existing.blocked = true;
        existing.resetAt = now + this.options.blockMs;
        return Math.ceil(this.options.blockMs / 1000);
      }
      return 0;
    }

    this.buckets.set(key, { hits: 1, resetAt: now + this.options.windowMs, blocked: false });
    return 0;
  }

  /**
   * Attempts recorded for this key in the current window.
   *
   * Lets a caller slow a key down instead of blocking it: a per-username block
   * would let an attacker lock a known admin out on purpose, while a growing
   * delay makes guessing impractical without ever closing the door.
   */
  hits(key: string): number {
    const bucket = this.buckets.get(key);
    return bucket && bucket.resetAt > Date.now() ? bucket.hits : 0;
  }

  /** Forgets a key — called after a success so honest users are never punished. */
  reset(key: string) {
    this.buckets.delete(key);
  }
}

/** Rejects with 429 while `limiter` is blocking the caller's address. */
export function rateLimit(limiter: RateLimiter, message: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const wait = limiter.hit(clientIp(req));
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: `${message} Coba lagi dalam ${wait} detik.` });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------

/**
 * Inline styles are used throughout the dashboard components, so style-src has
 * to allow them; scripts stay restricted to the bundle, which is what stops an
 * injected <script> from running.
 *
 * 'wasm-unsafe-eval' is the narrow permission WebAssembly needs once any CSP is
 * present. It is what lets the dashboard decode HEIC photos, which no browser
 * outside Safari can render on its own. Unlike 'unsafe-eval' it does not allow
 * evaluating JavaScript from a string, so the protection that matters stays on.
 */
/**
 * Cloudflare injects its Web Analytics beacon into HTML it proxies, so the
 * dashboard's own policy has to permit it or every page load logs a violation.
 * Turning Web Analytics off in the Cloudflare dashboard removes the need for
 * these two sources entirely.
 */
const CLOUDFLARE_BEACON = 'https://static.cloudflareinsights.com';

const DASHBOARD_CSP = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' ${CLOUDFLARE_BEACON}`,
  "style-src 'self' 'unsafe-inline'",
  // blob: covers the decoded HEIC frames, which are handed to <img> as object URLs.
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${CLOUDFLARE_BEACON} https://cloudflareinsights.com`,
  // The HEIC decoder runs libheif in a worker created from a blob URL. Without
  // this, worker-src falls back to script-src, which has no blob: source, and
  // the worker is refused — decoding then fails with an opaque event.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');

/** CSP for stored objects: they are data, and data never needs capabilities. */
export const OBJECT_CSP = "default-src 'none'; sandbox";

function isHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

/** Baseline headers for every response. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Only meaningful over TLS, and asserting it over plain LAN HTTP would make
  // the LAN address unreachable in browsers that had once seen the header.
  if (isHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  }

  next();
}

/** The stricter policy that belongs on the dashboard document itself. */
export function dashboardHeaders(res: Response) {
  res.setHeader('Content-Security-Policy', DASHBOARD_CSP);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
}

// ---------------------------------------------------------------------------
// Serving stored objects
// ---------------------------------------------------------------------------

/**
 * Types a browser may render in place without being able to run code.
 *
 * The uploader chooses the MIME type, and objects are served from the same
 * origin as the dashboard — so an HTML or SVG file rendered inline could read
 * the session token out of localStorage. Anything outside this list is handed
 * over as an opaque download instead.
 */
const INLINE_SAFE_PREFIXES = ['image/', 'video/', 'audio/'];
const INLINE_SAFE_EXACT = new Set(['application/pdf', 'text/plain']);
/** SVG is an image that can carry script, so it is excluded by name. */
const INLINE_UNSAFE_EXACT = new Set(['image/svg+xml', 'image/svg']);

export function isInlineSafeMimeType(mimeType: string): boolean {
  const type = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!type || INLINE_UNSAFE_EXACT.has(type)) return false;
  return INLINE_SAFE_EXACT.has(type) || INLINE_SAFE_PREFIXES.some(prefix => type.startsWith(prefix));
}

/**
 * Builds a Content-Disposition value that survives any filename.
 *
 * The stored original name is attacker-controlled: quotes would end the quoted
 * string early and control characters would split the header. The ASCII form is
 * scrubbed for old clients and the RFC 5987 form carries the real name.
 */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const fallback = (filename || 'file')
    // Keep printable ASCII only; drops CR, LF and everything non-Latin.
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 200) || 'file';

  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename || 'file')}`;
}
