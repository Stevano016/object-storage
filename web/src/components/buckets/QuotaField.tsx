import { formatBytes } from '../../lib/format';
import { draftToBytes, QUOTA_UNIT_BYTES } from '../../lib/quota';
import type { QuotaDraft, QuotaUnit } from '../../lib/quota';

const UNITS = Object.keys(QUOTA_UNIT_BYTES) as QuotaUnit[];

interface QuotaFieldProps {
  id: string;
  draft: QuotaDraft;
  onChange: (draft: QuotaDraft) => void;
  /** Shown under the field so the effect of an edit is visible before saving. */
  usedBytes?: number;
}

/**
 * The quota editor, shared by the create dialog and the change-quota dialog so
 * the two can never disagree about what an empty field means.
 */
export function QuotaField({ id, draft, onChange, usedBytes }: QuotaFieldProps) {
  const bytes = draftToBytes(draft);

  const hint = (() => {
    if (bytes === null) {
      return 'Kosongkan untuk tanpa batas — bucket hanya dibatasi kapasitas disk server.';
    }
    if (usedBytes === undefined) {
      return `Batas ${formatBytes(bytes)}. Unggahan yang melewatinya akan ditolak.`;
    }
    if (usedBytes > bytes) {
      return `Isi bucket sekarang ${formatBytes(usedBytes)} — sudah melampaui batas ini, `
        + 'jadi unggahan baru langsung ditolak sampai ada berkas yang dihapus.';
    }
    return `Terpakai ${formatBytes(usedBytes)}, sisa ${formatBytes(bytes - usedBytes)} dari ${formatBytes(bytes)}.`;
  })();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>Kuota Penyimpanan</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="form-input"
          id={id}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="Tanpa batas"
          value={draft.value}
          onChange={event => onChange({ ...draft, value: event.target.value })}
          style={{ flex: 1 }}
        />
        <select
          className="form-input"
          aria-label="Satuan kuota"
          value={draft.unit}
          onChange={event => onChange({ ...draft, unit: event.target.value as QuotaUnit })}
          style={{ width: '5.5rem', flexShrink: 0 }}
        >
          {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
        </select>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        {hint}
      </p>
    </div>
  );
}
