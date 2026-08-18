import { useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface UploadModalProps {
  bucketName: string;
  uploading: boolean;
  progress: number | null;
  onUpload: (file: File) => void;
  onClose: () => void;
}

export function UploadModal({ bucketName, uploading, progress, onUpload, onClose }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const [dropped] = Array.from(event.dataTransfer.files);
    if (dropped) onUpload(dropped);
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [selected] = Array.from(event.target.files ?? []);
    if (selected) onUpload(selected);
  };

  return (
    <Modal
      title={`Unggah Berkas ke '${bucketName}'`}
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose} disabled={uploading}>
          Tutup
        </button>
      }
    >
      {uploading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
          <Spinner size={40} />
          <span style={{ fontWeight: 500, marginTop: '1rem' }}>Sedang mengunggah berkas...</span>
          {progress !== null && (
            <div style={{ width: '100%', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>Kemajuan:</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className="dropzone"
          onDragOver={event => event.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input type="file" ref={inputRef} onChange={handleSelect} style={{ display: 'none' }} />
          <UploadCloud className="dropzone-icon" />
          <p className="dropzone-text">Klik atau seret berkas Anda ke sini</p>
          <p className="dropzone-subtext">Mendukung gambar, video, audio, dan dokumen hingga 500MB</p>
        </div>
      )}
    </Modal>
  );
}
