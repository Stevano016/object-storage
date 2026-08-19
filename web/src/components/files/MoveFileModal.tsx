import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { FileItem, FolderOption } from '../../types';

interface MoveFileModalProps {
  file: FileItem;
  bucketName: string;
  /** Where the file is now, so that option can be marked and disabled. */
  currentFolderId: string | null;
  onMove: (fileId: string, folderId: string | null) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Picks a destination folder for one file.
 *
 * The whole tree is fetched at open time rather than expanded lazily: a bucket
 * has tens of folders, not thousands, and one request means the list never
 * flickers as the user reads it.
 */
export function MoveFileModal({
  file,
  bucketName,
  currentFolderId,
  onMove,
  onClose
}: MoveFileModalProps) {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();

  const [options, setOptions] = useState<FolderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<string | null>(currentFolderId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    apiFetch<FolderOption[]>(`/api/buckets/${bucketName}/folders`)
      .then(list => { if (active) { setOptions(list); setLoading(false); } })
      .catch((error: Error) => {
        if (!active) return;
        showToast(error.message || 'Gagal memuat daftar folder.', 'error');
        setLoading(false);
      });

    return () => { active = false; };
  }, [apiFetch, bucketName, showToast]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (target === currentFolderId) {
      onClose();
      return;
    }

    setSaving(true);
    const moved = await onMove(file.id, target);
    setSaving(false);
    if (moved) onClose();
  };

  return (
    <Modal
      title={`Pindahkan '${file.originalName}'`}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Batal</button>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving || loading || target === currentFolderId}
          >
            {saving ? <Spinner size={18} /> : 'Pindahkan'}
          </button>
        </>
      }
    >
      {loading ? (
        <Spinner block padding="2rem" />
      ) : (
        <div className="form-group">
          <label className="form-label" htmlFor="move-target">Tujuan</label>
          <select
            className="form-input"
            id="move-target"
            value={target ?? ''}
            onChange={event => setTarget(event.target.value || null)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">
              {bucketName} (akar bucket){currentFolderId === null ? ' — lokasi sekarang' : ''}
            </option>
            {options.map(option => (
              <option key={option.id} value={option.id}>
                {/* Non-breaking spaces: a <select> collapses ordinary ones, and the
                    indent is the only cue for how deep a folder sits. */}
                {' '.repeat(option.depth * 3)}
                {option.name}
                {option.id === currentFolderId ? ' — lokasi sekarang' : ''}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Memindahkan berkas hanya mengubah catatannya, jadi berlaku seketika berapa pun
            ukuran berkasnya. Tautan langsung yang memakai ID berkas tetap berfungsi.
          </p>
        </div>
      )}
    </Modal>
  );
}
