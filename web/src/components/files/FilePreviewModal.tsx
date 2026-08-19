import { Download, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Modal } from '../ui/Modal';
import { FileTypeIcon } from '../ui/FileTypeIcon';
import { useClipboard } from '../../hooks/useClipboard';
import { useConfirm } from '../../context/ConfirmContext';
import { getFileKind } from '../../lib/files';
import { formatBytes, formatDateTime } from '../../lib/format';
import type { FileItem } from '../../types';

export interface PreviewLink {
  label: string;
  /** What the user sees — may be masked. */
  display: string;
  /** What actually lands on the clipboard. */
  copyValue: string;
  warning?: boolean;
}

interface FilePreviewModalProps {
  file: FileItem;
  /** Streamed inline by the <img>/<video>/<audio> tag. */
  mediaUrl: string;
  /** Same file, but forced as a download. */
  downloadUrl: string;
  links?: PreviewLink[];
  onDelete?: () => void;
  /** Extra footer controls, e.g. a "create share link" button. */
  extraActions?: ReactNode;
  onClose: () => void;
}

function LinkRow({ link }: { link: PreviewLink }) {
  const copy = useClipboard();

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        fontSize: '0.8rem',
        marginBottom: '0.25rem',
        color: link.warning ? 'var(--warning)' : undefined
      }}>
        <span>{link.label}</span>
        <button
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            flexShrink: 0
          }}
          onClick={() => void copy(link.copyValue)}
        >
          Salin Link
        </button>
      </div>
      <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', display: 'block' }}>{link.display}</code>
    </div>
  );
}

export function FilePreviewModal({
  file,
  mediaUrl,
  downloadUrl,
  links = [],
  onDelete,
  extraActions,
  onClose
}: FilePreviewModalProps) {
  const kind = getFileKind(file.mimeType);
  const confirm = useConfirm();

  const handleDelete = async () => {
    if (await confirm({
      title: 'Hapus berkas ini?',
      message: `'${file.originalName}' dihapus permanen dari server dan tidak bisa dikembalikan. `
        + 'Tautan langsung yang sudah dibagikan ke berkas ini akan mati.',
      confirmLabel: 'Hapus Berkas',
      danger: true
    })) {
      onDelete?.();
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
          {onDelete && (
            <button className="btn btn-danger" onClick={() => void handleDelete()}>
              <Trash2 style={{ width: 16, height: 16 }} />
              Hapus Berkas
            </button>
          )}
          {extraActions}
          <a
            className="btn btn-secondary"
            style={{ marginLeft: 'auto' }}
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
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

        {links.length > 0 && (
          <div className="dashboard-panel" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <span className="detail-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Tautan Berkas
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {links.map(link => <LinkRow key={link.label} link={link} />)}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
