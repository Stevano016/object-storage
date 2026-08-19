import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { bytesToDraft, draftToBytes, validateDraft } from '../../lib/quota';
import type { QuotaDraft } from '../../lib/quota';
import { QuotaField } from './QuotaField';
import type { Bucket } from '../../types';

interface BucketQuotaModalProps {
  bucket: Bucket;
  onClose: () => void;
  onSave: (bucket: Bucket, quotaBytes: number | null) => Promise<boolean>;
}

export function BucketQuotaModal({ bucket, onClose, onSave }: BucketQuotaModalProps) {
  const [quota, setQuota] = useState<QuotaDraft>(() => bytesToDraft(bucket.quotaBytes));
  const [saving, setSaving] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const problem = validateDraft(quota);
    setQuotaError(problem);
    if (problem) return;

    setSaving(true);
    const saved = await onSave(bucket, draftToBytes(quota));
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <Modal
      title={`Kuota Bucket '${bucket.name}'`}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner size={18} /> : 'Simpan Kuota'}
          </button>
        </>
      }
    >
      {/* Passing the live usage lets the hint show the remaining room as it is typed. */}
      <QuotaField
        id="bucket-quota-edit"
        draft={quota}
        onChange={draft => { setQuota(draft); setQuotaError(null); }}
        usedBytes={bucket.totalSize}
        error={quotaError}
      />

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Kuota dihitung dari total ukuran berkas di bucket ini, bukan dari kapasitas disk.
        Menurunkan kuota tidak menghapus berkas apa pun — hanya unggahan berikutnya yang ditolak.
      </p>
    </Modal>
  );
}
