import { Download, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FileTypeIcon } from '../ui/FileTypeIcon';
import { useAuth } from '../../context/AuthContext';
import { useClipboard } from '../../hooks/useClipboard';
import { buildFileUrl, buildPublicFileUrl, getFileKind } from '../../lib/files';
import { formatBytes, formatDateTime } from '../../lib/format';
import type { Bucket, FileItem } from '../../types';

interface FileDetailModalProps {
  file: FileItem;
  bucketName: string;
  bucket: Bucket | undefined;
  canDelete: boolean;
  onDelete: (fileId: string) => void;
  onClose: () => void;
}

interface LinkRowProps {
  label: string;
  url: string;
  onCopy: () => void;
  warning?: boolean;
}

function LinkRow({ label, url, onCopy, warning = false }: LinkRowProps) {
  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        marginBottom: '0.25rem',
        color: warning ? 'var(--warning)' : undefined
      }}>
        <span>{label}</span>
        <button
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
          onClick={onCopy}
        >
          Salin Link
        </button>
      </div>
      <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', display: 'block' }}>{url}</code>
    </div>
  );
}

export function FileDetailModal({
  file,
  bucketName,
  bucket,
  canDelete,
  onDelete,
  onClose
}: FileDetailModalProps) {
  const { apiUrl, token } = useAuth();
  const copy = useClipboard();

  const kind = getFileKind(file.mimeType);
  const isPrivate = bucket ? !bucket.isPublic : false;
  const mediaUrl = buildFileUrl({ apiUrl, bucket, bucketName, file, token });
  const publicUrl = buildPublicFileUrl(apiUrl, bucketName, file);
  const maskedTokenUrl = `${publicUrl}&token=${token ? `${token.substring(0, 15)}...` : ''}`;

  const handleDelete = () => {
    if (window.confirm('Hapus berkas ini secara permanen dari server?')) {
      onDelete(file.id);
    }
  };

  return (
    <Modal
      title={`Detail: ${file.originalName}`}
      onClose={onClose}
      large
      closeOnOverlayClick
      footer={
        <>
          {canDelete && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={handleDelete}>
              <Trash2 style={{ width: 16, height: 16 }} />
              Hapus Berkas
            </button>
          )}
          <a className="btn btn-secondary" href={mediaUrl} target="_blank" rel="noopener noreferrer">
            <Download style={{ width: 16, height: 16 }} />
            Unduh
          </a>
          <button className="btn btn-primary" onClick={onClose}>Tutup</button>
        </>
      }
    >
      <div className="media-preview-container">
        <div className="media-viewer">
          {kind === 'image' ? (
            <img src={mediaUrl} alt={file.originalName} />
          ) : kind === 'video' ? (
            <video controls preload="metadata" playsInline src={mediaUrl} />
          ) : kind === 'audio' ? (
            <audio controls preload="metadata" src={mediaUrl} style={{ width: '100%' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <FileTypeIcon mimeType={file.mimeType} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Pratinjau media tidak tersedia untuk tipe berkas ini.
              </span>
            </div>
          )}
        </div>

        <div className="file-details-list">
          <div className="detail-item">
            <span className="detail-label">Nama Asli</span>
            <span className="detail-value">{file.originalName}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Tipe File</span>
            <span className="detail-value">{file.mimeType}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Ukuran</span>
            <span className="detail-value">{formatBytes(file.size)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Tanggal Unggah</span>
            <span className="detail-value">{formatDateTime(file.createdAt)}</span>
          </div>
        </div>

        <div className="dashboard-panel" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <span className="detail-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
            Tautan Berkas
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <LinkRow
              label="URL Stream / Download:"
              url={publicUrl}
              onCopy={() => void copy(publicUrl)}
            />
            {isPrivate && (
              <LinkRow
                label="Tautan Terotentikasi (JWT Token):"
                url={maskedTokenUrl}
                onCopy={() => void copy(mediaUrl)}
                warning
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
