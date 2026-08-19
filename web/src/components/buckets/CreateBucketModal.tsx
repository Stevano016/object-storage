import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { FieldError } from '../ui/FieldError';
import { draftToBytes, UNLIMITED_DRAFT, validateDraft } from '../../lib/quota';
import { bucketName as validateBucketName } from '../../lib/validation';
import type { QuotaDraft } from '../../lib/quota';
import { QuotaField } from './QuotaField';

interface CreateBucketModalProps {
  onClose: () => void;
  onCreate: (name: string, isPublic: boolean, quotaBytes: number | null) => Promise<boolean>;
}

export function CreateBucketModal({ onClose, onCreate }: CreateBucketModalProps) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [quota, setQuota] = useState<QuotaDraft>(UNLIMITED_DRAFT);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Both problems are reported at once: fixing one field only to be told about
    // the other is the part of form validation people hate.
    const nameProblem = validateBucketName(name);
    const quotaProblem = validateDraft(quota);
    setNameError(nameProblem);
    setQuotaError(quotaProblem);
    if (nameProblem || quotaProblem) return;

    setSaving(true);
    const created = await onCreate(name.trim(), isPublic, draftToBytes(quota));
    setSaving(false);
    if (created) onClose();
  };

  return (
    <Modal
      title="Buat Bucket Baru"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner size={18} /> : 'Buat Bucket'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="bucket-name">Nama Bucket</label>
        <input
          className={`form-input${nameError ? ' has-error' : ''}`}
          id="bucket-name"
          type="text"
          placeholder="foto-kegiatan"
          value={name}
          onChange={event => { setName(event.target.value); setNameError(null); }}
          aria-invalid={nameError ? true : undefined}
        />
        {/* The error states the same rule as the hint, so only one is shown. */}
        {nameError
          ? <FieldError message={nameError} />
          : (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Hanya huruf kecil, angka, dan tanda hubung (-). Panjang 3-63 karakter.
            </p>
          )}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <QuotaField
          id="bucket-quota"
          draft={quota}
          onChange={draft => { setQuota(draft); setQuotaError(null); }}
          error={quotaError}
        />
      </div>

      <div className="form-group" style={{ marginTop: '1.5rem' }}>
        <label className="checkbox-label">
          <input
            className="checkbox-input"
            type="checkbox"
            checked={isPublic}
            onChange={event => setIsPublic(event.target.checked)}
          />
          Akses Publik (izinkan siapa saja mengakses berkas tanpa autentikasi)
        </label>
      </div>
    </Modal>
  );
}
