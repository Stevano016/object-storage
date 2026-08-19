import { DEFAULT_ADMIN_PASSWORD } from './db.js';

/**
 * Raised from 6 to 10. Six characters is inside brute-force range for an
 * attacker who can reach the login form from the open Internet, which is what
 * publishing the dashboard through a tunnel means.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Passwords that get tried first in every credential-stuffing run. This is a
 * deliberately short list — a full dictionary belongs in a library, and the
 * length rule already removes most of what people reach for.
 */
const OBVIOUS_PASSWORDS = new Set([
  '1234567890',
  '0123456789',
  'password12',
  'password123',
  'qwerty1234',
  'qwertyuiop',
  'adminadmin',
  'admin12345',
  'gentanstorage',
  DEFAULT_ADMIN_PASSWORD
]);

/**
 * Returns why a password is unacceptable, or null when it is fine.
 *
 * Checks composition rather than a score: the aim is to rule out the handful of
 * choices that make an account trivially guessable, not to lecture the user.
 */
export function validatePasswordStrength(password: unknown, username?: string): string | null {
  if (typeof password !== 'string') {
    return 'Password harus berupa teks.';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }

  const normalized = password.toLowerCase();

  if (OBVIOUS_PASSWORDS.has(normalized)) {
    return 'Password itu terlalu umum dan sudah ada di daftar tebakan pertama penyerang.';
  }

  if (username && normalized.includes(username.trim().toLowerCase())) {
    return 'Password tidak boleh memuat username.';
  }

  // A single repeated character passes the length rule but is not a password.
  if (new Set(password).size < 4) {
    return 'Password terlalu seragam. Gunakan kombinasi karakter yang lebih beragam.';
  }

  return null;
}
