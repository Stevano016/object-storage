import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { draftToBytes, UNLIMITED_DRAFT, validateDraft } from '../../lib/quota';
import type { QuotaDraft } from '../../lib/quota';
import { QuotaField } from './QuotaField';

interface CreateBucketModalProps {
  onClose: () => void;
  onCreate: (name: string, isPublic: boolean, quotaBytes: number | null) => Promise<boolean>;
}

export function CreateBucketModal({ onClose, onCreate }: CreateBucketModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [quota, setQuota] = useState<QuotaDraft>(UNLIMITED_DRAFT);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const quotaError = validateDraft(quota);
    if (quotaError) {
      showToast(quotaError, 'error');
      return;
    }

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
          className="form-input"
          id="bucket-name"
          type="text"
          placeholder="foto-kegiatan"
          value={name}
          onChange={event => setName(event.target.value)}
          required
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Hanya huruf kecil, angka, dan tanda hubung (-). Panjang 3-63 karakter.
        </p>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <QuotaField id="bucket-quota" draft={quota} onChange={setQuota} />
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
