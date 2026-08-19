export type QuotaUnit = 'MB' | 'GB' | 'TB';

export const QUOTA_UNIT_BYTES: Record<QuotaUnit, number> = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4
};

/** Mirrors the server's floor, so a hopeless value is refused before the round trip. */
export const MIN_QUOTA_BYTES = 1024 * 1024;

export interface QuotaDraft {
  /** Empty string means "no quota" — the state an emptied input naturally lands in. */
  value: string;
  unit: QuotaUnit;
}

export const UNLIMITED_DRAFT: QuotaDraft = { value: '', unit: 'GB' };

/** Converts an edited draft into bytes, or null when the field was left empty. */
export function draftToBytes({ value, unit }: QuotaDraft): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return Math.floor(amount * QUOTA_UNIT_BYTES[unit]);
}

/**
 * Picks the unit that shows a stored quota most plainly: 2 GB rather than
 * 2048 MB, while 1536 MB stays in MB because it is not a whole number of GB.
 */
export function bytesToDraft(bytes: number | null): QuotaDraft {
  if (!bytes || bytes <= 0) return UNLIMITED_DRAFT;

  const units: QuotaUnit[] = ['TB', 'GB', 'MB'];
  for (const unit of units) {
    const factor = QUOTA_UNIT_BYTES[unit];
    if (bytes >= factor && bytes % factor === 0) {
      return { value: String(bytes / factor), unit };
    }
  }

  // Not a round multiple of anything (e.g. a quota set through the API): show the
  // closest sensible unit with decimals rather than a wall of bytes.
  const unit: QuotaUnit = bytes >= QUOTA_UNIT_BYTES.TB ? 'TB' : bytes >= QUOTA_UNIT_BYTES.GB ? 'GB' : 'MB';
  return { value: String(parseFloat((bytes / QUOTA_UNIT_BYTES[unit]).toFixed(2))), unit };
}

/** Why a draft cannot be saved, or null when it is acceptable. */
export function validateDraft(draft: QuotaDraft): string | null {
  const trimmed = draft.value.trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Kuota harus berupa angka lebih dari nol, atau kosongkan untuk tanpa batas.';
  }

  const bytes = draftToBytes(draft);
  if (bytes !== null && bytes < MIN_QUOTA_BYTES) {
    return 'Kuota minimum 1 MB.';
  }

  return null;
}
