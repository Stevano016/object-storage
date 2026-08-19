import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError } from '../ui/FieldError';
import { Spinner } from '../ui/Spinner';

interface FolderNameModalProps {
  /** Present when renaming; absent when creating. */
  initialName?: string;
  /** Where a new folder will be created, for the hint line. */
  locationLabel: string;
  onSubmit: (name: string) => Promise<boolean>;
  onClose: () => void;
}

/** Same rules the server enforces, so a bad name is refused without a round trip. */
function validate(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Nama folder wajib diisi.';
  if (trimmed.length > 80) return 'Nama folder maksimal 80 karakter.';
  if (/[/\:*?"<>|]/.test(trimmed)) return 'Tidak boleh memuat / \ : * ? " < > |';
  if (trimmed === '.' || trimmed === '..') return 'Nama folder itu tidak diizinkan.';
  return null;
}

export function FolderNameModal({ initialName, locationLabel, onSubmit, onClose }: FolderNameModalProps) {
  const isRenaming = initialName !== undefined;
  const [name, setName] = useState(initialName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const problem = validate(name);
    setError(problem);
    if (problem) return;

    setSaving(true);
    const ok = await onSubmit(name.trim());
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={isRenaming ? `Ganti Nama '${initialName}'` : 'Buat Folder Baru'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner size={18} /> : isRenaming ? 'Simpan Nama' : 'Buat Folder'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="folder-name">Nama Folder</label>
        <input
          className={`form-input${error ? ' has-error' : ''}`}
          id="folder-name"
          type="text"
          placeholder="Dokumentasi Hari 1"
          value={name}
          onChange={event => { setName(event.target.value); setError(null); }}
          aria-invalid={error ? true : undefined}
          autoFocus
        />
        {error
          ? <FieldError message={error} />
          : (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isRenaming
                ? 'Berkas di dalamnya tidak berpindah — hanya namanya yang berubah.'
                : `Akan dibuat di ${locationLabel}.`}
            </p>
          )}
      </div>
    </Modal>
  );
}
