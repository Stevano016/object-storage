/**
 * Field rules shared by the dashboard forms.
 *
 * Each returns an Indonesian message or null. Keeping them here means the text a
 * user sees for "wajib diisi" is identical everywhere, and the rules that mirror
 * server-side checks (bucket name, password length) live next to each other so
 * the two cannot quietly drift apart.
 */

/** Mirrors MIN_PASSWORD_LENGTH in backend/src/utils/password.ts. */
export const MIN_PASSWORD_LENGTH = 10;

export function requiredText(value: string, label: string): string | null {
  return value.trim() ? null : `${label} wajib diisi.`;
}

/** Mirrors the bucket name regex enforced by the server. */
export function bucketName(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Nama bucket wajib diisi.';
  if (!/^[a-z0-9-]{3,63}$/.test(name)) {
    return 'Gunakan 3-63 karakter: huruf kecil, angka, atau tanda hubung (-).';
  }
  return null;
}

/** Mirrors the username regex enforced by the server. */
export function username(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Username wajib diisi.';
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) {
    return 'Gunakan 3-32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.';
  }
  return null;
}

/**
 * Mirrors validatePasswordStrength on the server, so a password is refused here
 * with the same reason rather than making a round trip to be told the same thing.
 */
export function password(value: string, forUsername?: string): string | null {
  if (!value) return 'Password wajib diisi.';
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (forUsername && value.toLowerCase().includes(forUsername.trim().toLowerCase())) {
    return 'Password tidak boleh memuat username.';
  }
  if (new Set(value).size < 4) {
    return 'Password terlalu seragam. Gunakan kombinasi karakter yang lebih beragam.';
  }
  return null;
}

export function passwordConfirmation(value: string, original: string): string | null {
  if (!value) return 'Konfirmasi password wajib diisi.';
  return value === original ? null : 'Konfirmasi tidak sama dengan password baru.';
}

/** True when no field in the map carries a message. */
export function isClean(errors: Record<string, string | null>): boolean {
  return Object.values(errors).every(message => !message);
}
