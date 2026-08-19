import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, UploadCloud } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { formatBytes } from '../../lib/format';
import type { UploadItem } from '../../hooks/useUploads';

interface UploadModalProps {
  bucketName: string;
  uploading: boolean;
  /** Per-file state for the batch; empty before the first drop. */
  items: UploadItem[];
  onUpload: (files: File[]) => void;
  onClose: () => void;
}

function UploadRow({ item }: { item: UploadItem }) {
  return (
    <li className="upload-row">
      <div className="upload-row-head">
        <span className="upload-row-name" title={item.name}>{item.name}</span>
        <span className="upload-row-meta">
          {item.status === 'selesai' && <CheckCircle2 className="upload-row-icon is-done" />}
          {item.status === 'gagal' && <AlertCircle className="upload-row-icon is-failed" />}
          {item.status === 'mengunggah' ? `${item.progress}%` : formatBytes(item.size)}
        </span>
      </div>

      {/* Only the file being sent gets a bar; the rest would be noise. */}
      {item.status === 'mengunggah' && (
        <div className="quota-bar" style={{ maxWidth: 'none', marginTop: '0.3rem' }}>
          <div className="quota-bar-fill" style={{ width: `${item.progress}%` }} />
        </div>
      )}

      {item.status === 'menunggu' && <span className="upload-row-note">Menunggu…</span>}
      {item.status === 'gagal' && <span className="upload-row-note is-failed">{item.error}</span>}
    </li>
  );
}

export function UploadModal({ bucketName, uploading, items, onUpload, onClose }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onUpload(dropped);
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > 0) onUpload(selected);
    // Cleared so picking the same files again still fires a change event.
    event.target.value = '';
  };

  const done = items.filter(item => item.status === 'selesai').length;
  const failed = items.filter(item => item.status === 'gagal').length;

  return (
    <Modal
      title={`Unggah Berkas ke '${bucketName}'`}
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
          {items.length > 0 && !uploading ? 'Selesai' : 'Tutup'}
        </button>
      }
    >
      {/* The dropzone stays available after a batch so more files can be added
          without reopening the dialog. */}
      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}${uploading ? ' is-disabled' : ''}`}
        onDragOver={event => { event.preventDefault(); if (!uploading) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={uploading ? event => event.preventDefault() : handleDrop}
        onClick={() => { if (!uploading) inputRef.current?.click(); }}
      >
        <input
          type="file"
          ref={inputRef}
          onChange={handleSelect}
          multiple
          style={{ display: 'none' }}
        />
        {uploading ? <Spinner size={32} /> : <UploadCloud className="dropzone-icon" />}
        <p className="dropzone-text">
          {uploading
            ? 'Sedang mengunggah…'
            : dragging
              ? 'Lepaskan untuk mengunggah'
              : 'Klik atau seret berkas ke sini'}
        </p>
        <p className="dropzone-subtext">
          Bisa beberapa berkas sekaligus — gambar, video, audio, dokumen, arsip. Maksimal 500 MB per berkas.
        </p>
      </div>

      {items.length > 0 && (
        <div className="upload-list-wrap">
          <div className="upload-list-head">
            <span>{items.length} berkas</span>
            <span>
              {done > 0 && `${done} selesai`}
              {done > 0 && failed > 0 && ' · '}
              {failed > 0 && <span className="is-failed">{failed} gagal</span>}
            </span>
          </div>
          <ul className="upload-list">
            {items.map(item => <UploadRow key={item.id} item={item} />)}
          </ul>
        </div>
      )}
    </Modal>
  );
}
